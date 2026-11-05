import type { IncomingMessage } from "node:http";
import { createId } from "@paralleldrive/cuid2";

export interface MiddlewareContext {
  readonly requestId: string;
  readonly ip: string;
  readonly namespace: string;
  readonly functionName: string;
  readonly requestStartTime: number;
  readonly req: IncomingMessage;
  readonly signal?: AbortSignal;
  [key: string]: unknown;
}

export type InferContext<T = unknown> = MiddlewareContext;

const REQUEST_ID_REGEX = /^[a-zA-Z0-9_\-\.]{1,64}$/;

export function extractClientIp(req: IncomingMessage | any, trustProxy: boolean = false): string {
  if (typeof req.ip === "string" && req.ip.trim().length > 0) {
    return req.ip.trim();
  }
  if (trustProxy) {
    const headers = req.headers ?? req.raw?.headers ?? {};
    const forwarded = headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim().length > 0) {
      const firstIp = forwarded.split(",")[0].trim();
      if (firstIp) return firstIp;
    }
    if (Array.isArray(forwarded) && forwarded[0]) {
      const firstIp = forwarded[0].split(",")[0].trim();
      if (firstIp) return firstIp;
    }
  }
  return req.socket?.remoteAddress ?? req.raw?.socket?.remoteAddress ?? "127.0.0.1";
}

export interface BuildContextOptions {
  trustProxy?: boolean;
  signal?: AbortSignal;
}

export function buildContext(
  req: IncomingMessage | any,
  namespace: string,
  functionName: string,
  options?: BuildContextOptions,
): MiddlewareContext {
  const headers = req.headers ?? req.raw?.headers ?? {};
  const customId = headers["x-request-id"] ?? headers["X-Request-Id"];
  const isValidCustomId = typeof customId === "string" && REQUEST_ID_REGEX.test(customId.trim());
  const requestId = isValidCustomId ? customId.trim() : createId();

  const rawReq = req.raw ?? req;
  const signal = options?.signal ?? rawReq?.signal;

  return {
    requestId,
    ip: extractClientIp(req, options?.trustProxy ?? false),
    namespace,
    functionName,
    requestStartTime: Date.now(),
    req: rawReq,
    signal,
  };
}
