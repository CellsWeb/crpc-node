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

  for await (const chunk of rawStream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;

    if (totalBytes > limit) {
      try {
        if (typeof rawStream.destroy === "function") {
          rawStream.destroy();
        }
      } catch {}
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

  const parsed = safeJsonParse(rawText);
  ensureValidJsonObject(parsed);
  return extractRpcFields(parsed);
}
