---
layout: default
title: Package & API Reference
nav_order: 12
---

# Package & API Reference

Exhaustive, production-grade reference of all exported classes, interfaces, options, and utilities across the CellsWeb RPC ecosystem.

---

## 📦 `@cellsweb/rpc-core`

The primary server engine powering CellsWeb RPC for Node.js, Bun, Hono, Elysia, and Fastify.

### 1. `CoreRPC` Class

```typescript
import { CoreRPC, type CoreRpcOptions } from "@cellsweb/rpc-core";

const app = new CoreRPC(options: CoreRpcOptions);
```

#### Lifecycle & Execution Methods

| Method | Signature | Description |
| :--- | :--- | :--- |
| `init()` | `(): Promise<void>` | Pre-indexes all functions and middlewares into $O(1)$ routing tables and pre-compiles TypeBox validators using JIT TypeCompiler. |
| `start()` | `(port?: number): Promise<void>` | Initializes the registry and starts listening on the configured HTTP port using the native Node.js HTTP server. |
| `fetch()` | `(request: Request): Promise<Response>` | Standard WinterCG Fetch API entry point. Used for Cloudflare Workers, Next.js route handlers, Bun, and Deno. |
| `execute()` | `(functionKey: string, payload: unknown, options?: ExecuteOptions): Promise<ExecuteResult>` | Direct in-process execution bypasses network sockets. Ideal for background queues, testing, and SSR Server Actions. |

#### Framework Adapter Methods

| Method | Signature | Description |
| :--- | :--- | :--- |
| `honoPlugin()` | `(): Hono` | Returns a pre-configured Hono sub-app with `/rpc`, `/docs`, and `/health` routes mounted. |
| `elysiaPlugin()` | `(): Elysia` | Returns an Elysia plugin with route definitions and multipart stream handlers. |
| `fastifyPlugin()` | `(): FastifyPluginAsync` | Returns an encapsulated Fastify plugin supporting pre-parsed and raw request payloads. |
| `serveBun()` | `(options?: BunServeOptions): BunServer` | Starts a native Bun HTTP listener utilizing `Bun.serve()` with kernel-level I/O. |

---

### 2. `CoreRpcOptions` Specification

All configuration settings supported by `new CoreRPC(options)`:

```typescript
export interface CoreRpcOptions {
  functionsDir?: string;
  middlewaresDir?: string;
  port?: number;
  host?: string;
  docs?: boolean;
  rpcEndpoint?: string;
  docsEndpoint?: string;
  healthEndpoint?: string;
  strict?: boolean;
  trustProxy?: boolean;
  useHttpStatusCodes?: boolean;
  cors?: boolean | CorsOptions;
  onTelemetry?: TelemetryHook;
}
```

#### Property Breakdown

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `functionsDir` | `string` | `"./src/functions"` | Absolute or relative filesystem path to the directory containing function procedures. |
| `middlewaresDir` | `string` | `"./src/middlewares"` | Absolute or relative filesystem path to the directory containing middleware definitions. |
| `port` | `number` | `4000` | TCP port for the server listener when invoking `app.start()`. |
| `host` | `string` | `"0.0.0.0"` | Network interface to bind to. Set to `"127.0.0.1"` for loopback-only access. |
| `docs` | `boolean` | `true` | Enables or disables the zero-config server-rendered documentation portal. |
| `rpcEndpoint` | `string` | `"/rpc"` | URL pathname designated for RPC `POST` dispatches. |
| `docsEndpoint` | `string` | `"/docs"` | URL pathname designated for the interactive documentation interface. |
| `healthEndpoint`| `string` | `"/health"` | URL pathname designated for health probe endpoints (returns `{ status: "ok" }`). |
| `strict` | `boolean` | `false` | When `true`, TypeBox validation rejects unknown or extraneous payload properties. |
| `trustProxy` | `boolean` | `false` | When `true`, inspects `X-Forwarded-For` and `X-Real-IP` headers for client IP resolution. Must be enabled only behind trusted reverse proxies (Cloudflare, ALB, Nginx). |
| `useHttpStatusCodes` | `boolean` | `false` | When `true`, maps RPC error codes to standard HTTP codes (`400`, `401`, `403`, `404`, `429`, `500`) for Layer 7 load balancers. Defaults to `false` (uniform HTTP 200). |
| `cors` | `boolean \| CorsOptions` | `true` | Configures CORS preflight and access control headers. Pass `false` to disable. |
| `onTelemetry` | `TelemetryHook` | `undefined` | Callback invoked on every RPC execution, providing detailed error and latency metrics for Sentry, Prometheus, and OpenTelemetry. |

---

### 3. `CorsOptions` Specification

```typescript
export interface CorsOptions {
  origin?: string | string[] | boolean | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}
```

- `origin`: Allowed origin(s). Can be a wildcard (`"*"`), explicit domain (`"https://myapp.com"`), array of allowed domains, or a dynamic validator function. Default: `"*"`
- `methods`: Permitted HTTP methods. Default: `["POST", "OPTIONS"]`
- `allowedHeaders`: Permitted HTTP request headers. Default: `["Content-Type", "Authorization", "X-Request-Id"]`
- `exposedHeaders`: Headers exposed to client scripts.
- `credentials`: Sets `Access-Control-Allow-Credentials: true`.
- `maxAge`: Seconds for preflight cache duration (`Access-Control-Max-Age`). Default: `86400` (24 hours).

---

### 4. Telemetry & Observability API

#### `TelemetryEvent` Structure

```typescript
export interface TelemetryEvent {
  status: "ok" | "error";
  namespace: string;
  functionName: string;
  requestId: string;
  durationMs: number;
  code?: string;
  message?: string;
  clientIp?: string;
  timestamp: string;
}

export type TelemetryHook = (event: TelemetryEvent) => void | Promise<void>;
```

#### Production Example: Sentry & Prometheus Integration

```typescript
import { CoreRPC } from "@cellsweb/rpc-core";
import * as Sentry from "@sentry/node";

export const app = new CoreRPC({
  onTelemetry: (event) => {
    if (event.status === "error") {
      Sentry.captureMessage(event.message || "RPC Error", {
        level: event.code === "internal_error" ? "error" : "warning",
        tags: {
          rpc_namespace: event.namespace,
          rpc_function: event.functionName,
          rpc_code: event.code,
        },
        extra: {
          requestId: event.requestId,
          durationMs: event.durationMs,
          clientIp: event.clientIp,
        },
      });
    }
  },
});
```

---

### 5. In-Process Testing Engine (`createTestCaller`)

Bypasses network sockets to execute RPC requests directly in-memory with full pipeline fidelity (validation, middlewares, worker threads).

```typescript
import { createTestCaller, type TestCaller } from "@cellsweb/rpc-core";

const caller: TestCaller = createTestCaller(app, {
  defaultHeaders: { authorization: "Bearer test-token" },
  defaultContext: { auth: { user: { id: "usr_mock" } } },
});
```

#### Methods

- `caller.call<TOutput>(key: string, data?: unknown, options?: CallOptions): Promise<TOutput>`
  - Unwraps and returns the typed `data` payload on success.
  - Automatically throws an `AppError` on RPC validation or middleware failure.
- `caller.callRaw(key: string, data?: unknown, options?: CallOptions): Promise<ExecuteResult>`
  - Returns the full envelope `{ status, data, code, message, meta }` without throwing.
  - Used for asserting specific error codes, metadata, and validation details.

---

### 6. Middlewares & Context

#### `defineMiddlewares`
Attaches configured middlewares to a function procedure:

```typescript
import { defineMiddlewares } from "@cellsweb/rpc-core";

export const middlewares = defineMiddlewares([
  { name: "rateLimit", options: { windowSeconds: 60, maxRequests: 100 } },
  { name: "auth", options: { requiredRole: "admin" } },
]);
```

#### `MiddlewareFn<TOptions>`
Type signature for custom middleware implementations:

```typescript
import type { MiddlewareFn, MiddlewareContext } from "@cellsweb/rpc-core";

export interface AuthOptions {
  requiredRole?: string;
}

export const run: MiddlewareFn<AuthOptions> = async (ctx: MiddlewareContext, options: AuthOptions) => {
  const token = ctx.headers["authorization"]?.replace("Bearer ", "");
  if (!token) {
    ctx.throw("unauthorized", "Missing Bearer token");
  }

  // 🔒 CRITICAL: Context MUST be namespaced under the middleware name
  ctx.auth = {
    user: await verifyUser(token),
  };
};
```

---

### 7. Form & Binary TypeBox Helpers

CellsWeb RPC provides TypeBox helpers designed for multipart form parsing and binary uploads:

- `File(options?: FileSchemaOptions)`: Defines a required binary file field (Web `File` / `Blob` or React Native asset).
- `Files(options?: FilesSchemaOptions)`: Defines an array of binary file uploads.
- `FormBool(options?: FormBoolOptions)`: Automatically coerces multipart form string values (`"true"`, `"false"`, `"1"`, `"0"`) into authentic JavaScript booleans.
- `FormNum(options?: FormNumOptions)`: Automatically coerces multipart numeric strings into authentic JavaScript numbers.

#### `UploadedFile` Class
Representation of an uploaded binary file in request handlers:

```typescript
export interface UploadedFile {
  originalFilename: string;
  filepath: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  destroy(): Promise<void>;
}
```

---

## 📦 `@cellsweb/rpc-client`

Universal client library for Web, React, Next.js, React Native, and Node.js.

### 1. `createRpcClient`

```typescript
import { createRpcClient } from "@cellsweb/rpc-client";

export const rpc = createRpcClient({
  baseUrl: "https://api.example.com",
  rpcEndpoint: "/rpc", // default
  timeoutMs: 15000,
  defaultHeaders: () => ({
    authorization: `Bearer ${getAccessToken()}`,
  }),
});
```

#### `RpcClientConfig` Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `baseUrl` | `string` | *(Required)* | Root URL of the API server (e.g. `"https://api.myapp.com"`). |
| `rpcEndpoint` | `string` | `"/rpc"` | RPC endpoint path. |
| `defaultHeaders` | `DynamicValue<Headers>` | `undefined` | Static object or dynamic synchronous/asynchronous getter function returning HTTP headers. |
| `defaultBody` | `DynamicValue<Object>` | `undefined` | Static object or dynamic getter function merged into top-level JSON request payloads. |
| `timeoutMs` | `number` | `30000` | Request timeout in milliseconds before triggering an `aborted` / `timeout` error. |
| `fetchFn` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation for mocking or specialized mobile networking libraries. |

---

### 2. Direct Invocation (`rawRpcRequest`)

Standalone requester for non-React services (Zustand, Redux, Next.js Server Actions, Node background workers):

```typescript
import { rawRpcRequest } from "@cellsweb/rpc-client";

const profile = await rawRpcRequest({
  baseUrl: "https://api.example.com",
  namespace: "user",
  functionName: "getProfile",
  data: { id: "usr_101" },
  headers: { authorization: "Bearer token" },
  multipart: false,
});
```

---

### 3. React Hooks (`@cellsweb/rpc-client`)

#### `<RpcProvider client={client}>`
Context provider wrapping your React component hierarchy:

```tsx
import { RpcProvider } from "@cellsweb/rpc-client";
import { rpc } from "@/lib/rpc";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <RpcProvider client={rpc}>{children}</RpcProvider>;
}
```

#### `useRpcQuery`
Data fetching hook with automatic race condition suppression, monotonic request sequence counters, and caching:

```tsx
const { data, isLoading, isError, error, refetch } = useRpcQuery(
  "catalog",
  "getProducts",
  { category: "tools" },
  {
    enabled: !!category,
    staleTime: 30000,
    refetchOnWindowFocus: true,
    onSuccess: (data) => console.log("Loaded", data),
    onError: (err) => console.error("Query failed", err.message),
  }
);
```

#### `useRpcMutation`
Stateful mutation hook for user actions and data mutations:

```tsx
const { mutate, mutateAsync, isLoading, error } = useRpcMutation(
  "catalog",
  "createProduct",
  {
    onMutate: (vars) => console.log("Creating...", vars),
    onSuccess: (result) => alert(`Created item ${result.id}`),
    onError: (err) => alert(err.message),
  }
);

// Trigger mutation:
mutate({ name: "Drill Bit", price: 12.99 });
```

---

### 4. Error Handling (`RpcError`)

```typescript
export class RpcError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly meta?: Record<string, unknown>;
}
```

#### Standard Error Codes

| Code | HTTP Equivalent | Description |
| :--- | :--- | :--- |
| `validation_error` | `400 Bad Request` | Input payload failed TypeBox schema rules. |
| `invalid_body` | `400 Bad Request` | Request body is missing, malformed, or exceeds size limits. |
| `unauthorized` | `401 Unauthorized` | Missing, expired, or invalid credentials. |
| `forbidden` | `403 Forbidden` | Access denied for the authenticated identity. |
| `not_found` | `404 Not Found` | Requested namespace or procedure does not exist in registry. |
| `rate_limit_exceeded`| `429 Too Many Requests`| Request rate quota exceeded for sliding-window interval. |
| `internal_error` | `500 Server Error` | Unhandled handler exception or middleware failure. |
| `timeout` | `504 Gateway Timeout` | Execution exceeded configured timeout duration. |
| `aborted` | `499 Client Closed` | Request aborted via `AbortSignal`. |
