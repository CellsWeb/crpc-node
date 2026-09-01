import type { IncomingMessage, ServerResponse } from "node:http";
import { AppError, ErrorCode, isAppError, toAppError } from "./errors";
import { buildContext, type MiddlewareContext } from "./context";
import { logRequestError, logRequestSuccess, logSystemError } from "./logger";
import { parseRpcRequest, type ParsedRpcRequest } from "./request";
import { cleanupTempFiles } from "./request/multipart";
import type { Registry } from "./registry";
import { getHighResDurationMs, withTimeout } from "./utils/timing";
import { safeJsonStringify } from "./utils/json";
import { validateSchema } from "./utils/typebox";

export async function handleApiRequest(
  req: IncomingMessage | any,
  res: ServerResponse | any,
  registry: Registry,
): Promise<void> {
  const startTime = process.hrtime();
  let parsedPayload: ParsedRpcRequest | undefined;
  let requestId = "unknown";
  let fnKey = "unknown";

  const responseObj = res.raw ?? res;
  if (typeof res.hijack === "function" && !responseObj.headersSent) {
    try {
      res.hijack();
    } catch {}
  }

  try {
    parsedPayload = await parseRpcRequest(req);
    const { namespace, functionName, data, kind } = parsedPayload;

    fnKey = `${namespace}.${functionName}`;
    const context = buildContext(req, namespace, functionName);
    requestId = context.requestId;
    const reqHeaders = req.headers ?? req.raw?.headers ?? {};

    const fnEntry = registry.functions.get(fnKey);
    if (!fnEntry) {
      throw new AppError(
        ErrorCode.FUNCTION_NOT_FOUND,
        `Function "${fnKey}" not found in registry`,
      );
    }

    // Allow JSON payloads to reach multipart functions — when the client has no file
    // to send (e.g. updating a record without changing the image), it sends JSON.
    // The function receives no file field which is valid when image is Type.Optional(...).
    // Only block the reverse: multipart sent to a JSON-only function.
    if (kind === "multipart" && fnEntry.contentType === "application/json") {
      throw new AppError(
        ErrorCode.INVALID_CONTENT_TYPE,
        `Function "${fnKey}" expects application/json, received multipart/form-data`,
      );
    }

    let currentContext: MiddlewareContext = context;

    for (const mwConfig of fnEntry.middlewares) {
      const mwEntry = registry.middlewares.get(mwConfig.name);
      if (!mwEntry) {
        logSystemError(`Middleware "${mwConfig.name}" declared on ${fnKey} but not found in registry.`);
        continue;
      }

      if (mwEntry.headersSchema) {
        validateSchema(mwEntry.headersSchema, reqHeaders, `Middleware headers for "${mwConfig.name}"`);
      }

      const options = mwConfig.options ?? {};
      if (mwEntry.optionsSchema) {
        validateSchema(mwEntry.optionsSchema, options, `Middleware options for "${mwConfig.name}"`);
      }

      const mwResult = await mwEntry.run(
        {
          headers: reqHeaders as Record<string, unknown>,
          options,
          function: {
            key: fnKey,
            namespace: fnEntry.namespace,
            functionName: fnEntry.functionName,
            metadata: fnEntry.metadata,
            contentType: fnEntry.contentType,
          },
        },
        currentContext,
      );

      if (mwResult && typeof mwResult === "object") {
        currentContext = mwResult as MiddlewareContext;
      }
    }

    if (fnEntry.headersSchema) {
      validateSchema(fnEntry.headersSchema, reqHeaders, `Headers for "${fnKey}"`);
    }

    const validatedInput = fnEntry.inputSchema
      ? validateSchema(fnEntry.inputSchema, data, `Input for "${fnKey}"`)
      : data;

    const timeoutMs = process.env.API_REQUEST_TIMEOUT_MS ? Number(process.env.API_REQUEST_TIMEOUT_MS) : 30000;

    const rawResult = await withTimeout(
      fnEntry.run(validatedInput, currentContext),
      timeoutMs,
      `Function ${fnKey}`,
    );

    let validatedOutput = rawResult;
    if (fnEntry.outputSchema) {
      try {
        validatedOutput = validateSchema(fnEntry.outputSchema, rawResult, `Output for "${fnKey}"`);
      } catch (schemaErr) {
        logSystemError(`Output schema mismatch — bug in run.ts for function ${fnKey}`, schemaErr);
        throw new AppError(
          ErrorCode.SCHEMA_MISMATCH,
          "Response schema mismatch — check function run.ts output.",
          isAppError(schemaErr) ? schemaErr.details : undefined,
          false,
        );
      }
    }

    const durationMs = getHighResDurationMs(startTime);

    const payload = safeJsonStringify({
      status: "ok",
      data: validatedOutput,
      meta: {
        requestId,
        durationMs,
      },
    });

    responseObj.statusCode = 200;
    if (typeof responseObj.setHeader === "function") {
      responseObj.setHeader("Content-Type", "application/json; charset=utf-8");
      responseObj.setHeader("X-Request-Id", requestId);
    }
    responseObj.end(payload);

    logRequestSuccess(requestId, fnKey, durationMs);
  } catch (err) {
    const durationMs = getHighResDurationMs(startTime);
    const appErr = toAppError(err);

    logRequestError(requestId, appErr.code, appErr.message, durationMs, appErr.internal ? err : undefined);

    const clientPayload = appErr.toClientPayload(requestId, durationMs);

    responseObj.statusCode = 200;
    if (typeof responseObj.setHeader === "function") {
      responseObj.setHeader("Content-Type", "application/json; charset=utf-8");
      responseObj.setHeader("X-Request-Id", requestId);
    }
    responseObj.end(safeJsonStringify(clientPayload));
  } finally {
    if (parsedPayload?.tempFilesToCleanup && parsedPayload.tempFilesToCleanup.length > 0) {
      cleanupTempFiles(parsedPayload.tempFilesToCleanup);
    }
  }
}
