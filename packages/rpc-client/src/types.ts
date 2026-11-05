export type DynamicValue<T> = T | (() => T | Promise<T>);

export interface RpcResponseSuccess<T = unknown> {
  status: "ok";
  data: T;
  meta: {
    requestId?: string;
    durationMs?: number;
    [key: string]: unknown;
  };
}

export interface RpcResponseError {
  status: "error";
  code: string;
  message: string;
  meta?: {
    requestId?: string;
    durationMs?: number;
    [key: string]: unknown;
  };
}

export type RpcResponse<T = unknown> = RpcResponseSuccess<T> | RpcResponseError;

export interface RpcClientConfig {
  baseUrl: string;
  rpcEndpoint?: string;
  defaultHeaders?: DynamicValue<Record<string, string>>;
  defaultBody?: DynamicValue<Record<string, unknown>>;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface RawRpcRequestOptions<TVariables = unknown> {
  baseUrl: string;
  rpcEndpoint?: string;
  namespace: string;
  functionName: string;
  data?: TVariables;
  headers?: Record<string, string>;
  defaultBody?: Record<string, unknown>;
  multipart?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  fetchFn?: typeof fetch;
}

export interface RpcRequestOptions<TVariables = unknown> {
  namespace: string;
  functionName: string;
  data?: TVariables;
  headers?: Record<string, string>;
  multipart?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}
