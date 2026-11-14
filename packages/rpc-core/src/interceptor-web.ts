import { buildWebContext } from "./context";
import { AppError, ErrorCode, toAppError, mapErrorCodeToHttpStatus } from "./errors";
import { logRequestError } from "./logger";
import { runPipeline } from "./pipeline";
import type { Registry } from "./registry";
import { cleanupTempFiles } from "./request/multipart";
import { normalizeWebHeaders, parseWebRequest } from "./request/web";
import type { ParsedRpcRequest } from "./request";
import { safeJsonStringify } from "./utils/json";
import { getHighResDurationMs } from "./utils/timing";

export interface HandleWebRpcRequestOptions {
  trustProxy?: boolean;
  useHttpStatusCodes?: boolean;
  corsHeaders?: Record<string, string>;
  maxMultipartBytes?: number;
  maxSingleFileBytes?: number;
  maxJsonBytes?: number;
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
    parsedPayload = await parseWebRequest(request, {
      maxMultipartBytes: options.maxMultipartBytes,
      maxSingleFileBytes: options.maxSingleFileBytes,
      maxJsonBytes: options.maxJsonBytes,
    });
    const { namespace, functionName, data, kind } = parsedPayload;

    fnKey = `${namespace}.${functionName}`;
    const context = buildWebContext(request, namespace, functionName, {
      trustProxy: options.trustProxy,
    });
    requestId = context.requestId;
    const reqHeaders = normalizeWebHeaders(request.headers);

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
    });

    const payload = safeJsonStringify({
      status: "ok",
      data: result.data,
      meta: {
        requestId,
        durationMs: result.durationMs,
      },
    });

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
