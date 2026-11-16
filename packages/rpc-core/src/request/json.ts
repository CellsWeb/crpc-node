import type { IncomingMessage } from "node:http";
import { AppError, ErrorCode } from "../errors";
import { safeJsonParse } from "../utils/json";
import { validateRoutingIdentifier } from "./routing";

export interface ParsedJsonRpcPayload {
  readonly namespace: string;
  readonly functionName: string;
  readonly data: unknown;
}

function ensureValidJsonObject(parsed: unknown): asserts parsed is Record<string, unknown> {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError(
      ErrorCode.INVALID_BODY,
      "Expected a top-level JSON object with namespace and functionName",
    );
  }
}

function extractRpcFields(obj: Record<string, unknown>): ParsedJsonRpcPayload {
  const namespace = validateRoutingIdentifier(obj.namespace, "namespace");
  const functionName = validateRoutingIdentifier(obj.functionName, "functionName");
  const data = obj.data !== undefined ? obj.data : {};
  return { namespace, functionName, data };
}

function drainRejectedJsonRequest(stream: IncomingMessage): void {
  if (stream.destroyed || stream.readableEnded) return;

  const maxDrainBytes = 512 * 1024;
  let drainedBytes = 0;
  let timer: NodeJS.Timeout | undefined;
  const cleanup = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    stream.removeListener("data", onData);
    stream.removeListener("end", cleanup);
    stream.removeListener("close", cleanup);
    stream.removeListener("aborted", cleanup);
    stream.removeListener("error", cleanup);
    stream.socket?.removeListener("close", stop);
  };
  const stop = () => {
    cleanup();
    stream.destroy();
  };
  const onData = (chunk: Buffer | string) => {
    drainedBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
    if (drainedBytes > maxDrainBytes) stop();
  };

  stream.on("end", cleanup);
  stream.on("close", cleanup);
  stream.on("aborted", cleanup);
  stream.on("error", cleanup);
  stream.on("data", onData);
  // After an early response Node may detach the request before a peer disconnects.
  stream.socket?.on("close", stop);
  // Install the deadline before resuming, including for streams that finish immediately.
  timer = setTimeout(stop, 2000);
  timer.unref();
  stream.resume();
}

export async function parseJsonRequest(
  req: IncomingMessage | any,
  maxBytes?: number,
): Promise<ParsedJsonRpcPayload> {
  // ── 1. Check if framework (Fastify / Express) already parsed or captured the body ──
  const preParsed =
    req.body !== undefined
      ? req.body
      : (req as any).rawBody !== undefined
      ? (req as any).rawBody
      : req.raw && (req.raw as any).body !== undefined
      ? (req.raw as any).body
      : req.raw && (req.raw as any).rawBody !== undefined
      ? (req.raw as any).rawBody
      : undefined;

  if (preParsed !== undefined) {
    if (typeof preParsed === "string") {
      if (!preParsed.trim()) {
        throw new AppError(ErrorCode.INVALID_BODY, "Request body is empty");
      }
      const parsed = safeJsonParse(preParsed);
      ensureValidJsonObject(parsed);
      return extractRpcFields(parsed);
    }

    if (Buffer.isBuffer(preParsed)) {
      const rawText = preParsed.toString("utf-8");
      if (!rawText.trim()) {
        throw new AppError(ErrorCode.INVALID_BODY, "Request body is empty");
      }
      const parsed = safeJsonParse(rawText);
      ensureValidJsonObject(parsed);
      return extractRpcFields(parsed);
    }

    ensureValidJsonObject(preParsed);
    return extractRpcFields(preParsed);
  }

  // ── 4. Fallback: Stream consumer for native node:http ──
  const rawStream = req.raw ?? req;
  const limit =
    maxBytes ??
    (process.env.MAX_JSON_BODY_BYTES
      ? Number(process.env.MAX_JSON_BODY_BYTES)
      : 1_048_576);

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  // Explicit listeners avoid async-iterator teardown destroying the HTTP socket on rejection.
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      rawStream.removeListener("data", onData);
      rawStream.removeListener("end", onEnd);
      rawStream.removeListener("error", onError);
      rawStream.removeListener("aborted", onAborted);
      rawStream.removeListener("close", onClose);
    };
    const onError = (err: Error) => {
      cleanup();
      chunks.length = 0;
      reject(err);
    };
    const onAborted = () => onError(new AppError(ErrorCode.INVALID_BODY, "Client disconnected before JSON body completed"));
    const onClose = () => {
      if (!rawStream.readableEnded) onAborted();
    };
    const onEnd = () => {
      cleanup();
      resolve();
    };
    const onData = (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > limit) {
        cleanup();
        chunks.length = 0;
        drainRejectedJsonRequest(rawStream);
        reject(new AppError(
          ErrorCode.PAYLOAD_TOO_LARGE,
          `JSON request payload exceeds max allowed limit of ${limit} bytes`,
        ));
        return;
      }
      chunks.push(buf);
    };

    if (rawStream.destroyed || rawStream.aborted) { onAborted(); return; }
    if (rawStream.readableEnded) { onEnd(); return; }
    rawStream.on("end", onEnd);
    rawStream.on("error", onError);
    rawStream.on("aborted", onAborted);
    rawStream.on("close", onClose);
    rawStream.on("data", onData);
  });

  const rawText = Buffer.concat(chunks).toString("utf-8");
  if (!rawText.trim()) {
    throw new AppError(ErrorCode.INVALID_BODY, "Request body is empty");
  }

  const parsed = safeJsonParse(rawText);
  ensureValidJsonObject(parsed);
  return extractRpcFields(parsed);
}
