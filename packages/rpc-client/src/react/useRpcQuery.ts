import { useCallback, useEffect, useState } from "react";
import { useRpcClient } from "./context";
import type { RpcRequestOptions } from "../types";

export interface UseRpcQueryOptions<TData = unknown, TVariables = Record<string, unknown>>
  extends RpcRequestOptions<TVariables> {
  enabled?: boolean;
  onSuccess?: (data: TData) => void;
  onError?: (error: unknown) => void;
}

function safeSerialize(val: unknown): string {
  if (val === undefined || val === null) return String(val);
  if (typeof val !== "object") return String(val);
  try {
    return JSON.stringify(val, (_key, value) => {
      if (typeof Blob !== "undefined" && value instanceof Blob) {
        return `[Blob:${value.size}:${value.type}]`;
      }
      if (typeof File !== "undefined" && value instanceof File) {
        return `[File:${value.name}:${value.size}]`;
      }
      if (value && typeof value === "object" && typeof value.uri === "string") {
        return `[RNFile:${value.uri}]`;
      }
      return value;
    });
  } catch {
    return String(val);
  }
}

export function useRpcQuery<TData = unknown, TVariables = Record<string, unknown>>(
  options: UseRpcQueryOptions<TData, TVariables>,
) {
  const client = useRpcClient();

  const {
    namespace,
    functionName,
    data,
    headers,
    multipart,
    timeoutMs,
    signal,
    enabled = true,
    onSuccess,
    onError,
  } = options;

  const serializedData = safeSerialize(data);
  const serializedHeaders = safeSerialize(headers);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<TData | undefined>(undefined);

  const execute = useCallback(
    async (overrideData?: TVariables, overrideHeaders?: Record<string, string>) => {
      setLoading(true);
      setError(null);
      try {
        const res = await client.request<TData, TVariables>({
          namespace,
          functionName,
          data: overrideData ?? data,
          headers: overrideHeaders ? { ...headers, ...overrideHeaders } : headers,
          multipart,
          timeoutMs,
          signal,
        });
        setResult(res);
        onSuccess?.(res);
        return res;
      } catch (err: unknown) {
        setError(err);
        onError?.(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, namespace, functionName, serializedData, serializedHeaders, multipart, timeoutMs, signal, onSuccess, onError],
  );

  useEffect(() => {
    if (!enabled) return;
    execute().catch(() => {});
  }, [enabled, namespace, functionName, serializedData]);

  return {
    data: result,
    loading,
    error,
    refetch: execute,
  };
}
