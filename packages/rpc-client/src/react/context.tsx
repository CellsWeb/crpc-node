import React, { createContext, useContext, useMemo } from "react";
import { RpcClient, createRpcClient } from "../client";
import type { RpcClientConfig } from "../types";

export interface RpcProviderProps extends Partial<RpcClientConfig> {
  client?: RpcClient;
  children: React.ReactNode;
}

const RpcContext = createContext<RpcClient | null>(null);

export const RpcProvider: React.FC<RpcProviderProps> = ({
  client,
  baseUrl,
  rpcEndpoint,
  defaultHeaders,
  defaultBody,
  timeoutMs,
  fetchFn,
  children,
}) => {
  const rpcInstance = useMemo(() => {
    if (client) return client;
    if (!baseUrl) {
      throw new Error("RpcProvider requires either a 'client' instance or 'baseUrl' prop.");
    }
    return createRpcClient({
      baseUrl,
      rpcEndpoint,
      defaultHeaders,
      defaultBody,
      timeoutMs,
      fetchFn,
    });
  }, [client, baseUrl, rpcEndpoint, defaultHeaders, defaultBody, timeoutMs, fetchFn]);

  return <RpcContext.Provider value={rpcInstance}>{children}</RpcContext.Provider>;
};

export function useRpcClient(): RpcClient {
  const ctx = useContext(RpcContext);
  if (!ctx) {
    throw new Error("useRpcClient must be used within an <RpcProvider>.");
  }
  return ctx;
}
