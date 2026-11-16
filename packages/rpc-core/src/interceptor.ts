import type { IncomingMessage, ServerResponse } from "node:http";
import { AppError, ErrorCode, toAppError, mapErrorCodeToHttpStatus } from "./errors";
import { buildContext } from "./context";
import { logRequestError } from "./logger";
import { detectRequestKind } from "./request/content-type";
import { validateRoutingIdentifier } from "./request/routing";
import { parseRpcRequest, type ParsedRpcRequest } from "./request";
import { cleanupTempFiles } from "./request/multipart";
import type { Registry } from "./registry";
import { getHighResDurationMs } from "./utils/timing";
import { safeJsonStringify } from "./utils/json";
import { executeMiddlewareChain, runPipeline } from "./pipeline";
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
    const rawHeaders = (req.headers ?? req.raw?.headers ?? {}) as Record<string, unknown>;
    const getHeader = (k: string): string | undefined => {
      const v = rawHeaders[k] ?? rawHeaders[k.toLowerCase()] ?? (typeof req.headers?.get === "function" ? req.headers.get(k) : undefined);
      return typeof v === "string" ? v : undefined;
    };
    const contentType = getHeader("content-type");
    const kind = detectRequestKind(contentType);

    let context: any;
    let skipPipelineMiddlewares = false;
    let headerRoutingTarget: { namespace: string; functionName: string } | undefined;

    // Fast-path for multipart with header routing: resolve function and execute middlewares
    // BEFORE reading or parsing a single byte of the multipart body!
    if (kind === "multipart") {
      const headerNs = getHeader("x-crpc-namespace");
      const headerFn = getHeader("x-crpc-function");

      if ((headerNs && !headerFn) || (!headerNs && headerFn)) {
        throw new AppError(
          ErrorCode.INVALID_BODY,
          "Both X-CRPC-Namespace and X-CRPC-Function headers must be provided together, or both omitted",
        );
      }

      if (headerNs && headerFn) {
        const namespace = validateRoutingIdentifier(headerNs, "namespace", "headers");
        const functionName = validateRoutingIdentifier(headerFn, "functionName", "headers");
        headerRoutingTarget = { namespace, functionName };
        fnKey = `${namespace}.${functionName}`;

        const fnEntry = registry.functions.get(fnKey);
        if (!fnEntry) {
          throw new AppError(
            ErrorCode.FUNCTION_NOT_FOUND,
            `Function "${fnKey}" not found in registry`,
          );
        }

        if (fnEntry.contentType === "application/json") {
          throw new AppError(
            ErrorCode.INVALID_CONTENT_TYPE,
            `Function "${fnKey}" expects application/json, received multipart/form-data`,
          );
        }

        context = buildContext(req, namespace, functionName, {
          trustProxy: options?.trustProxy,
        });
        requestId = context.requestId;

        // Run middlewares NOW. If auth/rateLimit fails, it throws immediately.
        // Zero file bytes are read or parsed.
        context = await executeMiddlewareChain(fnEntry, registry, context, rawHeaders, fnKey, startTime);
        skipPipelineMiddlewares = true;
      }
    }

    const onBeforeFileSave = async (fields: Record<string, string | string[]>) => {
      if (skipPipelineMiddlewares) return;

      const rawNs = fields.namespace;
      const rawFn = fields.functionName;
      if (!rawNs || !rawFn) {
        throw new AppError(
          ErrorCode.INVALID_BODY,
          "Routing fields ('namespace', 'functionName') must appear before file parts in multipart payload",
        );
      }
      if (Array.isArray(rawNs) || Array.isArray(rawFn)) {
        throw new AppError(
          ErrorCode.INVALID_BODY,
          "Duplicate routing fields ('namespace' or 'functionName') in multipart payload",
        );
      }

      const namespace = validateRoutingIdentifier(rawNs, "namespace", "multipart payload");
      const functionName = validateRoutingIdentifier(rawFn, "functionName", "multipart payload");
      fnKey = `${namespace}.${functionName}`;

      const fnEntry = registry.functions.get(fnKey);
      if (!fnEntry) {
        throw new AppError(
          ErrorCode.FUNCTION_NOT_FOUND,
          `Function "${fnKey}" not found in registry`,
        );
      }

      if (fnEntry.contentType === "application/json") {
        throw new AppError(
          ErrorCode.INVALID_CONTENT_TYPE,
          `Function "${fnKey}" expects application/json, received multipart/form-data`,
        );
      }

      context = buildContext(req, namespace, functionName, {
        trustProxy: options?.trustProxy,
      });
      requestId = context.requestId;

      context = await executeMiddlewareChain(fnEntry, registry, context, rawHeaders, fnKey, startTime);
      skipPipelineMiddlewares = true;
    };

    parsedPayload = await parseRpcRequest(req, { onBeforeFileSave });
    const { namespace, functionName, data } = parsedPayload;

    if (headerRoutingTarget) {
      if (
        parsedPayload.namespace !== headerRoutingTarget.namespace ||
        parsedPayload.functionName !== headerRoutingTarget.functionName
      ) {
        throw new AppError(
          ErrorCode.INVALID_BODY,
          `Routing mismatch: headers specify "${headerRoutingTarget.namespace}.${headerRoutingTarget.functionName}" but body specifies "${parsedPayload.namespace}.${parsedPayload.functionName}"`,
        );
      }
    }

    if (!fnKey || fnKey === "unknown") {
      fnKey = `${namespace}.${functionName}`;
    }

    if (!context) {
      context = buildContext(req, namespace, functionName, {
        trustProxy: options?.trustProxy,
      });
      requestId = context.requestId;
    }

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
    if (parsedPayload.kind === "multipart" && fnEntry.contentType === "application/json") {
      throw new AppError(
        ErrorCode.INVALID_CONTENT_TYPE,
        `Function "${fnKey}" expects application/json, received multipart/form-data`,
      );
    }

    const result = await runPipeline({
      key: fnKey,
      data,
      headers: rawHeaders,
      context,
      registry,
      skipMiddlewares: skipPipelineMiddlewares,
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
