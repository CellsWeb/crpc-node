import { useCallback, useState } from "react";
import { useRpcClient } from "./context";
import type { RpcRequestOptions } from "../types";

export interface UseRpcMutationOptions<TData = unknown, TVariables = Record<string, unknown>>
  extends Partial<RpcRequestOptions<TVariables>> {
  namespace: string;
  functionName: string;
  onSuccess?: (data: TData) => void;
  onError?: (error: unknown) => void;
}

export function useRpcMutation<TData = unknown, TVariables = Record<string, unknown>>(
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
    onSuccess,
    onError,
  } = options;

  const mutate = useCallback(
    async (overrideData?: TVariables, overrideHeaders?: Record<string, string>) => {
      setLoading(true);
      setError(null);
      try {
        const finalData = overrideData !== undefined ? overrideData : defaultData;
        const finalHeaders = overrideHeaders ? { ...defaultHeaders, ...overrideHeaders } : defaultHeaders;

        const res = await client.request<TData, TVariables>({
          namespace,
          functionName,
          data: finalData as TVariables,
          headers: finalHeaders,
          multipart,
          timeoutMs,
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
    [client, namespace, functionName, defaultData, defaultHeaders, multipart, timeoutMs, onSuccess, onError],
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
