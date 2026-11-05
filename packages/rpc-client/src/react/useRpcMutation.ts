import { useCallback, useState } from "react";
import { useRpcClient } from "./context";
import type { RpcRequestOptions } from "../types";

export interface UseRpcMutationOptions<TData = unknown, TVariables = unknown>
  extends Partial<RpcRequestOptions<TVariables>> {
  namespace: string;
  functionName: string;
  onSuccess?: (data: TData) => void;
  onError?: (error: unknown) => void;
}

export function useRpcMutation<TData = unknown, TVariables = unknown>(
  options: UseRpcMutationOptions<TData, TVariables>,
) {
  const client = useRpcClient();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<unknown>(null);

  const {
    namespace,
    functionName,
    data: defaultData,
    headers: defaultHeaders,
    multipart,
    timeoutMs,
    signal: defaultSignal,
    onSuccess,
    onError,
  } = options;

  const mutate = useCallback(
    async (
      overrideData?: TVariables,
      overrideHeaders?: Record<string, string>,
      overrideSignal?: AbortSignal,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const finalData = overrideData !== undefined ? overrideData : defaultData;
        const finalHeaders = overrideHeaders ? { ...defaultHeaders, ...overrideHeaders } : defaultHeaders;
        const finalSignal = overrideSignal ?? defaultSignal;

        const res = await client.request<TData, TVariables>({
          namespace,
          functionName,
          data: finalData as TVariables,
          headers: finalHeaders,
          multipart,
          timeoutMs,
          signal: finalSignal,
        });

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
    [client, namespace, functionName, defaultData, defaultHeaders, multipart, timeoutMs, defaultSignal, onSuccess, onError],
  );

  return {
    mutate,
    loading,
    error,
    reset: () => {
      setLoading(false);
      setError(null);
    },
  };
}
