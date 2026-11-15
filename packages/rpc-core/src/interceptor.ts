import type { IncomingMessage, ServerResponse } from "node:http";
import { AppError, ErrorCode, toAppError, mapErrorCodeToHttpStatus } from "./errors";
import { buildContext } from "./context";
import { logRequestError } from "./logger";
import { parseRpcRequest, type ParsedRpcRequest } from "./request";
import { cleanupTempFiles } from "./request/multipart";
import type { Registry } from "./registry";
import { getHighResDurationMs } from "./utils/timing";
import { safeJsonStringify } from "./utils/json";
import { runPipeline } from "./pipeline";
import type { TelemetryEvent, TelemetryHook } from "./telemetry";

export async function handleApiRequest(
  req: IncomingMessage | any,
  res: ServerResponse | any,
  registry: Registry,
  options?: {
    trustProxy?: boolean;
    useHttpStatusCodes?: boolean;
    onTelemetry?: TelemetryHook;
  },
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
    const context = buildContext(req, namespace, functionName, {
      trustProxy: options?.trustProxy,
    });
    requestId = context.requestId;
    const reqHeaders = (req.headers ?? req.raw?.headers ?? {}) as Record<string, unknown>;

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

    const result = await runPipeline({
      key: fnKey,
      data,
      headers: reqHeaders,
      context,
      registry,
    });

    const payload = safeJsonStringify({
      status: "ok",
      data: result.data,
      meta: {
        requestId,
        durationMs: result.durationMs,
      },
    });

    if (!responseObj.headersSent) {
      responseObj.statusCode = 200;
      if (typeof responseObj.setHeader === "function") {
        responseObj.setHeader("Content-Type", "application/json; charset=utf-8");
        responseObj.setHeader("X-Request-Id", requestId);
        responseObj.setHeader("X-Content-Type-Options", "nosniff");
        responseObj.setHeader("X-Frame-Options", "DENY");
        responseObj.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      }
    }
    if (!responseObj.writableEnded) {
      responseObj.end(payload);
    }

    if (typeof options?.onTelemetry === "function") {
      try {
        options.onTelemetry({
          requestId,
          namespace: parsedPayload?.namespace,
          functionName: parsedPayload?.functionName,
          status: "ok",
          durationMs: result.durationMs,
          clientIp: req.socket?.remoteAddress,
          userAgent: req.headers?.["user-agent"],
        });
      } catch {}
    }
  } catch (err) {
    const durationMs = getHighResDurationMs(startTime);
    const appErr = toAppError(err);

    logRequestError(
      requestId,
      appErr.code,
      appErr.message,
      durationMs,
      appErr.internal ? err : undefined,
    );

    const clientPayload = appErr.toClientPayload(requestId, durationMs);
    const statusCode = options?.useHttpStatusCodes
      ? mapErrorCodeToHttpStatus(appErr.code)
      : 200;

    if (!responseObj.headersSent) {
      responseObj.statusCode = statusCode;
      if (typeof responseObj.setHeader === "function") {
        responseObj.setHeader("Content-Type", "application/json; charset=utf-8");
        responseObj.setHeader("X-Request-Id", requestId);
        responseObj.setHeader("X-Content-Type-Options", "nosniff");
        responseObj.setHeader("X-Frame-Options", "DENY");
        responseObj.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      }
    }
    if (!responseObj.writableEnded) {
      responseObj.end(safeJsonStringify(clientPayload));
    }

    if (typeof options?.onTelemetry === "function") {
      try {
        options.onTelemetry({
          requestId,
          namespace: parsedPayload?.namespace,
          functionName: parsedPayload?.functionName,
          status: "error",
          code: appErr.code,
          message: appErr.message,
          durationMs,
          clientIp: req.socket?.remoteAddress,
          userAgent: req.headers?.["user-agent"],
          error: err,
        });
      } catch {}
    }
  } finally {
    if (parsedPayload?.tempFilesToCleanup && parsedPayload.tempFilesToCleanup.length > 0) {
      cleanupTempFiles(parsedPayload.tempFilesToCleanup);
    }
  }
}
