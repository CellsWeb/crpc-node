import safeStringify from "safe-stable-stringify";
import { AppError, ErrorCode } from "../errors";

export function safeJsonParse<T = unknown>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new AppError(ErrorCode.INVALID_BODY, "Invalid JSON body format");
  }
}

export function safeJsonStringify(data: unknown): string {
  return safeStringify(data) ?? "{}";
}
