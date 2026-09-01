import type { IncomingMessage } from "node:http";
import { createId } from "@paralleldrive/cuid2";

export interface MiddlewareContext {
  readonly requestId: string;
  readonly ip: string;
  readonly namespace: string;
  readonly functionName: string;
  readonly requestStartTime: number;
  readonly req: IncomingMessage;
  [key: string]: unknown;
}

export type InferContext<T = unknown> = MiddlewareContext;

export function extractClientIp(req: IncomingMessage | any): string {
  if (typeof req.ip === "string" && req.ip.trim().length > 0) {
    return req.ip.trim();
  }
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
  return req.socket?.remoteAddress ?? req.raw?.socket?.remoteAddress ?? "127.0.0.1";
}

export function buildContext(
  req: IncomingMessage | any,
  namespace: string,
  functionName: string,
): MiddlewareContext {
  const headers = req.headers ?? req.raw?.headers ?? {};
  const customId = headers["x-request-id"];
  const requestId = typeof customId === "string" && customId.trim() ? customId.trim() : createId();

  return {
    requestId,
    ip: extractClientIp(req),
    namespace,
    functionName,
    requestStartTime: Date.now(),
    req: req.raw ?? req,
  };
}
