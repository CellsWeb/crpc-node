import type { CoreRPC } from "./core-rpc";
import { AppError, ErrorCode } from "./errors";

export interface ExecuteOptions {
  headers?: Record<string, string | string[] | undefined>;
  contextOverrides?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface ExecuteResult<T = unknown> {
  status: "ok" | "error";
  data?: T;
  code?: string;
  message?: string;
  details?: unknown;
  meta: {
    requestId: string;
    durationMs: number;
    [key: string]: unknown;
  };
}

export interface TestCaller {
  call: <T = unknown>(
    key: string,
    data?: unknown,
    overrides?: Partial<ExecuteOptions> & Record<string, unknown>,
  ) => Promise<T>;
  callRaw: <T = unknown>(
    key: string,
    data?: unknown,
    overrides?: Partial<ExecuteOptions> & Record<string, unknown>,
  ) => Promise<ExecuteResult<T>>;
}

export function createTestCaller(
  app: CoreRPC,
  defaultOptions: ExecuteOptions = {},
): TestCaller {
  return {
    call: async <T = unknown>(
      key: string,
      data?: unknown,
      overrides: Partial<ExecuteOptions> & Record<string, unknown> = {},
    ): Promise<T> => {
      const { headers, contextOverrides, timeoutMs, ...restContext } = overrides;
      const mergedOptions: ExecuteOptions = {
        headers: { ...(defaultOptions.headers ?? {}), ...(headers ?? {}) },
        contextOverrides: {
          ...(defaultOptions.contextOverrides ?? {}),
          ...(contextOverrides ?? {}),
          ...restContext,
        },
        timeoutMs: timeoutMs ?? defaultOptions.timeoutMs,
      };

      const result = await app.execute<T>(key, data, mergedOptions);
      if (result.status === "error") {
        throw new AppError(
          (result.code as ErrorCode) ?? ErrorCode.INTERNAL_ERROR,
          result.message ?? "RPC execution failed",
          result.details,
          false,
        );
      }
      return result.data as T;
    },
    callRaw: async <T = unknown>(
      key: string,
      data?: unknown,
      overrides: Partial<ExecuteOptions> & Record<string, unknown> = {},
    ): Promise<ExecuteResult<T>> => {
      const { headers, contextOverrides, timeoutMs, ...restContext } = overrides;
      const mergedOptions: ExecuteOptions = {
        headers: { ...(defaultOptions.headers ?? {}), ...(headers ?? {}) },
        contextOverrides: {
          ...(defaultOptions.contextOverrides ?? {}),
          ...(contextOverrides ?? {}),
          ...restContext,
        },
        timeoutMs: timeoutMs ?? defaultOptions.timeoutMs,
      };

      return app.execute<T>(key, data, mergedOptions);
    },
  };
}
