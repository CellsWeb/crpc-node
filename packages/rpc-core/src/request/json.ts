import type { IncomingMessage } from "node:http";
import { AppError, ErrorCode } from "../errors";
import { safeJsonParse } from "../utils/json";

export interface ParsedJsonRpcPayload {
  readonly namespace: string;
  readonly functionName: string;
  readonly data: Record<string, unknown>;
}

export async function parseJsonRequest(
  req: IncomingMessage | any,
  maxBytes?: number,
): Promise<ParsedJsonRpcPayload> {
  // ── 1. Check if framework (Fastify / Express) already parsed the body ──
  const preParsed =
    req.body ??
    (req as any).rawBody ??
    (req.raw && (req.raw as any).body) ??
    (req.raw && (req.raw as any).rawBody);

  if (preParsed && typeof preParsed === "object" && !Buffer.isBuffer(preParsed)) {
    const namespace = preParsed.namespace;
    const functionName = preParsed.functionName;

    if (typeof namespace !== "string" || !namespace.trim()) {
      throw new AppError(
        ErrorCode.INVALID_BODY,
        'Missing or invalid "namespace" field in JSON body',
      );
    }

    if (typeof functionName !== "string" || !functionName.trim()) {
      throw new AppError(
        ErrorCode.INVALID_BODY,
        'Missing or invalid "functionName" field in JSON body',
      );
    }

    const data =
      typeof preParsed.data === "object" && preParsed.data !== null
        ? (preParsed.data as Record<string, unknown>)
        : {};

    return {
      namespace: namespace.trim(),
      functionName: functionName.trim(),
      data,
    };
  }

  // ── 2. If preParsed is string (e.g. raw string body) ──
  if (typeof preParsed === "string" && preParsed.trim().length > 0) {
    const parsed = safeJsonParse<Record<string, unknown>>(preParsed);
    const namespace = parsed.namespace;
    const functionName = parsed.functionName;

    if (typeof namespace !== "string" || !namespace.trim()) {
      throw new AppError(
        ErrorCode.INVALID_BODY,
        'Missing or invalid "namespace" field in JSON body',
      );
    }

    if (typeof functionName !== "string" || !functionName.trim()) {
      throw new AppError(
        ErrorCode.INVALID_BODY,
        'Missing or invalid "functionName" field in JSON body',
      );
    }

    const data =
      typeof parsed.data === "object" && parsed.data !== null
        ? (parsed.data as Record<string, unknown>)
        : {};

    return {
      namespace: namespace.trim(),
      functionName: functionName.trim(),
      data,
    };
  }

  // ── 3. If preParsed is Buffer ──
  if (Buffer.isBuffer(preParsed)) {
    const rawText = preParsed.toString("utf-8");
    if (!rawText.trim()) {
      throw new AppError(ErrorCode.INVALID_BODY, "Request body is empty");
    }

    const parsed = safeJsonParse<Record<string, unknown>>(rawText);
    const namespace = parsed.namespace;
    const functionName = parsed.functionName;

    if (typeof namespace !== "string" || !namespace.trim()) {
      throw new AppError(
        ErrorCode.INVALID_BODY,
        'Missing or invalid "namespace" field in JSON body',
      );
    }

    if (typeof functionName !== "string" || !functionName.trim()) {
      throw new AppError(
        ErrorCode.INVALID_BODY,
        'Missing or invalid "functionName" field in JSON body',
      );
    }

    const data =
      typeof parsed.data === "object" && parsed.data !== null
        ? (parsed.data as Record<string, unknown>)
        : {};

    return {
      namespace: namespace.trim(),
      functionName: functionName.trim(),
      data,
    };
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

  for await (const chunk of rawStream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;

    if (totalBytes > limit) {
      throw new AppError(
        ErrorCode.PAYLOAD_TOO_LARGE,
        `JSON request payload exceeds max allowed limit of ${limit} bytes`,
      );
    }
    chunks.push(buf);
  }

  const rawText = Buffer.concat(chunks).toString("utf-8");
  if (!rawText.trim()) {
    throw new AppError(ErrorCode.INVALID_BODY, "Request body is empty");
  }

  const parsed = safeJsonParse<Record<string, unknown>>(rawText);

  const namespace = parsed.namespace;
  const functionName = parsed.functionName;

  if (typeof namespace !== "string" || !namespace.trim()) {
    throw new AppError(
      ErrorCode.INVALID_BODY,
      'Missing or invalid "namespace" field in JSON body',
    );
  }

  if (typeof functionName !== "string" || !functionName.trim()) {
    throw new AppError(
      ErrorCode.INVALID_BODY,
      'Missing or invalid "functionName" field in JSON body',
    );
  }

  const data =
    typeof parsed.data === "object" && parsed.data !== null
      ? (parsed.data as Record<string, unknown>)
      : {};

  return {
    namespace: namespace.trim(),
    functionName: functionName.trim(),
    data,
  };
}
