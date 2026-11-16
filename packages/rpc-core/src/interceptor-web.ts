import { buildWebContext } from "./context";
import { AppError, ErrorCode, toAppError, mapErrorCodeToHttpStatus } from "./errors";
import { logRequestError } from "./logger";
import { executeMiddlewareChain, runPipeline } from "./pipeline";
import type { Registry } from "./registry";
import { cleanupTempFiles } from "./request/multipart";
import { validateRoutingIdentifier } from "./request/routing";
import { normalizeWebHeaders, parseWebRequest } from "./request/web";
import type { ParsedRpcRequest } from "./request";
import { safeJsonStringify } from "./utils/json";
import { getHighResDurationMs } from "./utils/timing";

import type { TelemetryHook } from "./telemetry";

export interface HandleWebRpcRequestOptions {
  trustProxy?: boolean;
  useHttpStatusCodes?: boolean;
  corsHeaders?: Record<string, string>;
  maxMultipartBytes?: number;
  maxSingleFileBytes?: number;
  maxJsonBytes?: number;
  onTelemetry?: TelemetryHook;
}

export async function handleWebRpcRequest(
  request: Request,
  registry: Registry,
  options: HandleWebRpcRequestOptions = {},
): Promise<Response> {
  const startTime = process.hrtime();
  let parsedPayload: ParsedRpcRequest | undefined;
  let requestId = "unknown";
  let fnKey = "unknown";

  try {
    const contentType = request.headers.get("content-type") || "";
    const isMultipart = contentType.toLowerCase().includes("multipart/form-data");
    const reqHeaders = normalizeWebHeaders(request.headers);

    let context: any;
    let skipPipelineMiddlewares = false;
    let headerRoutingTarget: { namespace: string; functionName: string } | undefined;

    // Fast-path for multipart with header routing: resolve function and execute middlewares
    // BEFORE reading or parsing a single byte of the multipart body!
    if (isMultipart) {
      const headerNs = request.headers.get("x-crpc-namespace");
      const headerFn = request.headers.get("x-crpc-function");

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

        context = buildWebContext(request, namespace, functionName, {
          trustProxy: options.trustProxy,
        });
        requestId = context.requestId;

        // Run middlewares NOW. If auth/rateLimit fails, it throws immediately.
        // Zero file bytes are read or parsed.
        context = await executeMiddlewareChain(fnEntry, registry, context, reqHeaders, fnKey, startTime);
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

      context = buildWebContext(request, namespace, functionName, {
        trustProxy: options.trustProxy,
      });
      requestId = context.requestId;

      context = await executeMiddlewareChain(fnEntry, registry, context, reqHeaders, fnKey, startTime);
      skipPipelineMiddlewares = true;
    };

    parsedPayload = await parseWebRequest(request, {
      maxMultipartBytes: options.maxMultipartBytes,
      maxSingleFileBytes: options.maxSingleFileBytes,
      maxJsonBytes: options.maxJsonBytes,
      onBeforeFileSave,
    });
    const { namespace, functionName, data, kind } = parsedPayload;

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
      context = buildWebContext(request, namespace, functionName, {
        trustProxy: options.trustProxy,
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

    if (typeof options.onTelemetry === "function") {
      try {
        options.onTelemetry({
          requestId,
          namespace: parsedPayload?.namespace,
          functionName: parsedPayload?.functionName,
          status: "ok",
          durationMs: result.durationMs,
          userAgent: request.headers.get("user-agent") ?? undefined,
        });
      } catch {}
    }

    return new Response(payload, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Request-Id": requestId,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        ...(options.corsHeaders ?? {}),
      },
    });
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
    const status = options.useHttpStatusCodes
      ? mapErrorCodeToHttpStatus(appErr.code)
      : 200;

    if (typeof options.onTelemetry === "function") {
      try {
        options.onTelemetry({
          requestId,
          namespace: parsedPayload?.namespace,
          functionName: parsedPayload?.functionName,
          status: "error",
          code: appErr.code,
          message: appErr.message,
          durationMs,
          userAgent: request.headers.get("user-agent") ?? undefined,
          error: err,
        });
      } catch {}
    }

    return new Response(safeJsonStringify(clientPayload), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Request-Id": requestId,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        ...(options.corsHeaders ?? {}),
      },
    });
  } finally {
    if (parsedPayload?.tempFilesToCleanup && parsedPayload.tempFilesToCleanup.length > 0) {
      cleanupTempFiles(parsedPayload.tempFilesToCleanup);
    }
  }
}
