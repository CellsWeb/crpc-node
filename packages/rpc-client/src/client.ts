/**
 * client.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Core RPC Client implementation for CellsWeb RPC APIs.
 *
 * Standard web FormData uses the configured fetchFn. React Native bridge
 * FormData exposes getParts() for native URI-file serialization and retains
 * the XMLHttpRequest transport for compatibility with RCTNetworking.
 */

import { RpcError } from "./errors";
import { buildRpcFormData, hasMultipartData } from "./multipart";
import type {
  DynamicValue,
  RawRpcRequestOptions,
  RpcClientConfig,
  RpcRequestOptions,
  RpcResponse,
} from "./types";

async function resolveDynamicValue<T>(val?: DynamicValue<T>): Promise<T | undefined> {
  if (val === undefined) return undefined;
  if (typeof val === "function") {
    return (val as () => T | Promise<T>)();
  }
  return val;
}

/**
 * Send a multipart FormData request via XMLHttpRequest.
 * Retained for React Native bridge FormData, including { uri, name, type }
 * file parts passed through RCTNetworking.
 */
function sendMultipartXHR<TData>(
  url: string,
  formData: FormData,
  headers: Record<string, string>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<TData> {
  return new Promise<TData>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = timeoutMs;

    // Set all headers EXCEPT Content-Type — XHR sets it automatically with boundary
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() !== "content-type") {
        xhr.setRequestHeader(key, value);
      }
    }

    xhr.onload = () => {
      try {
        const json: RpcResponse<TData> = JSON.parse(xhr.responseText);
        if (json.status === "error") {
          reject(
            new RpcError({
              message: json.message ?? "RPC Request failed",
              code: json.code,
              status: xhr.status,
              meta: json.meta,
              details: json.details,
            }),
          );
        } else {
          resolve(json.data);
        }
      } catch {
        reject(
          new RpcError({
            message: `Failed to parse server response (${xhr.status})`,
            code: "parse_error",
            status: xhr.status,
          }),
        );
      }
    };

    xhr.onerror = () => {
      reject(new RpcError({ message: "Network request failed", code: "network_error" }));
    };

    xhr.ontimeout = () => {
      reject(new RpcError({ message: "RPC Request timeout", code: "timeout", status: 408 }));
    };

    xhr.onabort = () => {
      reject(new RpcError({ message: "RPC Request aborted", code: "aborted" }));
    };

    if (signal) {
      if (signal.aborted) {
        reject(new RpcError({ message: "RPC Request aborted", code: "aborted" }));
        return;
      }
      const onAbort = () => xhr.abort();
      signal.addEventListener("abort", onAbort, { once: true });
      const originalOnLoad = xhr.onload;
      const originalOnError = xhr.onerror;
      const originalOnTimeout = xhr.ontimeout;
      const originalOnAbort = xhr.onabort;

      const removeAbortListener = () => {
        signal.removeEventListener("abort", onAbort);
      };

      xhr.onload = (e) => {
        removeAbortListener();
        if (typeof originalOnLoad === "function") originalOnLoad.call(xhr, e);
      };
      xhr.onerror = (e) => {
        removeAbortListener();
        if (typeof originalOnError === "function") originalOnError.call(xhr, e);
      };
      xhr.ontimeout = (e) => {
        removeAbortListener();
        if (typeof originalOnTimeout === "function") originalOnTimeout.call(xhr, e);
      };
      xhr.onabort = (e) => {
        removeAbortListener();
        if (typeof originalOnAbort === "function") originalOnAbort.call(xhr, e);
      };
    }

    xhr.send(formData);
  });
}

/**
 * Standalone direct RPC Request function.
 * Usable anywhere outside of React context/providers.
 */
export async function rawRpcRequest<TData = unknown>(
  options: RawRpcRequestOptions,
): Promise<TData> {
  const {
    baseUrl,
    rpcEndpoint = "/rpc",
    namespace,
    functionName,
    data,
    headers: customHeaders,
    defaultBody,
    multipart = false,
    timeoutMs = 30000,
    signal: userSignal,
    fetchFn = fetch,
  } = options;

  if (!baseUrl || typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
    throw new RpcError({
      message:
        'RPC Client Error: "baseUrl" is required. Please set baseUrl (e.g. "http://localhost:4000/rpc").',
      code: "configuration_error",
    });
  }

  let targetUrl = baseUrl.replace(/\/+$/, "");
  if (rpcEndpoint && rpcEndpoint.trim().length > 0) {
    const cleanEp = rpcEndpoint.startsWith("/") ? rpcEndpoint : `/${rpcEndpoint}`;
    if (!targetUrl.endsWith(cleanEp)) {
      // Only append endpoint if targetUrl is root domain/host or doesn't match an endpoint
      try {
        const parsed = new URL(targetUrl);
        if (parsed.pathname === "" || parsed.pathname === "/") {
          targetUrl = `${targetUrl}${cleanEp}`;
        }
      } catch {
        targetUrl = `${targetUrl}${cleanEp}`;
      }
    }
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
  const onUserAbort = () => abortController.abort();

  if (userSignal) {
    if (userSignal.aborted) {
      clearTimeout(timeoutId);
      throw new RpcError({ message: "RPC Request aborted", code: "aborted" });
    }
    userSignal.addEventListener("abort", onUserAbort, { once: true });
  }

  try {
    const headers: Record<string, string> = { ...customHeaders };
    const isPlainObject = (val: unknown): val is Record<string, unknown> =>
      typeof val === "object" && val !== null && !Array.isArray(val);

    let mergedData: unknown;
    if (defaultBody && isPlainObject(defaultBody) && isPlainObject(data)) {
      mergedData = { ...defaultBody, ...data };
    } else {
      mergedData = data !== undefined ? data : (defaultBody ?? {});
    }

    const isMultipart = multipart || hasMultipartData(mergedData);

    if (isMultipart) {
      headers["X-CRPC-Namespace"] = namespace;
      headers["X-CRPC-Function"] = functionName;

      const formData = buildRpcFormData(
        namespace,
        functionName,
        mergedData as Record<string, unknown>,
      );

      // Let the selected transport supply the multipart boundary.
      for (const k of Object.keys(headers)) {
        if (k.toLowerCase() === "content-type") delete headers[k];
      }

      // Native FormData's getParts() is consumed by the RN networking bridge.
      // Check the representation, not navigator/Hermes globals shared by shims.
      if (
        typeof XMLHttpRequest !== "undefined" &&
        "getParts" in formData &&
        typeof formData.getParts === "function"
      ) {
        return await sendMultipartXHR<TData>(
          targetUrl,
          formData,
          headers,
          timeoutMs,
          abortController.signal,
        );
      }

      // Standard web FormData honors fetchFn even when XHR is also available.
      const response = await fetchFn(targetUrl, {
        method: "POST",
        headers,
        body: formData,
        signal: abortController.signal,
      });

      let json: RpcResponse<TData>;
      try {
        json = await response.json();
      } catch {
        throw new RpcError({
          message: `Server returned non-JSON response with HTTP status ${response.status}`,
          code: "parse_error",
          status: response.status,
        });
      }

      if (json.status === "error") {
        throw new RpcError({
          message: json.message ?? "RPC Request failed",
          code: json.code,
          status: response.status,
          meta: json.meta,
          details: json.details,
        });
      }
      return json.data;
    } else {
      headers["Content-Type"] = "application/json";
      const body = JSON.stringify({ namespace, functionName, data: mergedData });

      const response = await fetchFn(targetUrl, {
        method: "POST",
        headers,
        body,
        signal: abortController.signal,
      });

      let json: RpcResponse<TData>;
      try {
        json = await response.json();
      } catch {
        throw new RpcError({
          message: `Server returned non-JSON response with HTTP status ${response.status}`,
          code: "parse_error",
          status: response.status,
        });
      }

      if (json.status === "error") {
        throw new RpcError({
          message: json.message ?? "RPC Request failed",
          code: json.code,
          status: response.status,
          meta: json.meta,
          details: json.details,
        });
      }
      return json.data;
    }
  } catch (err: unknown) {
    if ((err as { name?: string })?.name === "AbortError") {
      if (userSignal?.aborted) {
        throw new RpcError({ message: "RPC Request aborted", code: "aborted" });
      }
      throw new RpcError({ message: "RPC Request timeout", code: "timeout", status: 408 });
    }
    if (err instanceof RpcError) throw err;
    throw new RpcError({
      message: (err as Error)?.message ?? "Network request failed",
      code: "network_error",
    });
  } finally {
    clearTimeout(timeoutId);
    if (userSignal) {
      userSignal.removeEventListener("abort", onUserAbort);
    }
  }
}

/**
 * RpcClient class configured with default baseUrl, headers, and body.
 */
export class RpcClient {
  private config: RpcClientConfig;

  constructor(config: RpcClientConfig) {
    this.config = {
      ...config,
      timeoutMs: config.timeoutMs ?? 30000,
    };
  }

  public getConfig(): RpcClientConfig {
    return this.config;
  }

  public async request<TData = unknown, TVariables = Record<string, unknown>>(
    options: RpcRequestOptions<TVariables>,
  ): Promise<TData> {
    const resolvedDefaultHeaders = (await resolveDynamicValue(this.config.defaultHeaders)) ?? {};
    const resolvedDefaultBody = (await resolveDynamicValue(this.config.defaultBody)) ?? {};

    const mergedHeaders = {
      ...resolvedDefaultHeaders,
      ...options.headers,
    };

    return rawRpcRequest<TData>({
      baseUrl: this.config.baseUrl,
      rpcEndpoint: this.config.rpcEndpoint,
      namespace: options.namespace,
      functionName: options.functionName,
      data: options.data as any,
      headers: mergedHeaders,
      defaultBody: resolvedDefaultBody,
      multipart: options.multipart,
      timeoutMs: options.timeoutMs ?? this.config.timeoutMs,
      signal: options.signal,
      fetchFn: this.config.fetchFn,
    });
  }
}

export function createRpcClient(config: RpcClientConfig): RpcClient {
  return new RpcClient(config);
}
