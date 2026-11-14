---
layout: default
title: Package & API Reference
nav_order: 12
---

# Package & API Reference

Exhaustive reference of all packages and symbols exported by the CellsWeb RPC Node monorepo.

---

## 📦 `@cellsweb/rpc-core`

### `CoreRPC` Class

```typescript
class CoreRPC {
  constructor(options: CoreRpcOptions);

  init(): Promise<void>;
  start(port?: number): Promise<void>;
  fetch(request: Request): Promise<Response>;
  
  // Framework Plugins:
  honoPlugin(): Hono;
  elysiaPlugin(): Elysia;
  fastifyPlugin(): FastifyPluginAsync;
  serveBun(options?: BunServeOptions): BunServer;

  // In-Process Direct Calling:
  execute(functionKey: string, payload: any, options?: ExecuteOptions): Promise<ExecuteResult>;
}
```

#### `CoreRpcOptions`
- `functionsDir?: string` — Directory containing RPC functions (default: `"./src/functions"`)
- `middlewaresDir?: string` — Directory containing middlewares (default: `"./src/middlewares"`)
- `port?: number` — Server listen port (default: `4000`)
- `rpcEndpoint?: string` — Path for RPC POST handler (default: `"/rpc"`)
- `docsEndpoint?: string` — Path for documentation portal (default: `"/docs"`)
- `docs?: boolean` — Enable interactive documentation portal (default: `true`)
- `cors?: boolean | CorsOptions` — Enable preflight and CORS headers (default: `true`)
- `trustProxy?: boolean` — Trust `X-Forwarded-For` proxy headers (default: `false`)

---

### In-Process Test Runner

#### `createTestCaller(app: CoreRPC, defaultOptions?: TestCallerOptions)`
Creates an in-process caller with `call(key, data)` and `callRaw(key, data)`.

---

### Scaffolding Utilities

- `defineMiddlewares(attachments: MiddlewareAttachment[])` — Type-safe middleware chain helper.
- `scaffoldFunction(baseDir: string, spec: FunctionSpec): Promise<void>` — Programmatic function generator.
- `scaffoldMiddleware(baseDir: string, spec: MiddlewareSpec): Promise<void>` — Programmatic middleware generator.

---

## 📦 `@cellsweb/rpc-client`

### Client Creation

#### `createRpcClient(options: RpcClientOptions): RpcClient`
- `baseUrl: string` — Target `/rpc` endpoint URL.
- `defaultHeaders?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>)`
- `defaultBody?: Record<string, unknown>`

#### `rawRpcRequest(options: RawRpcRequestOptions): Promise<T>`
Direct standalone API caller for non-React contexts.

---

### React Hooks

- `<RpcProvider client={client}>` — Context provider wrapping your React/Next.js tree.
- `useRpcQuery(namespace, functionName, data, options)` — Data fetching with deduplication and race condition suppression.
- `useRpcMutation(namespace, functionName, options)` — Action mutations with loading, error, and return data states.

---

### Errors

#### `RpcError`
```typescript
class RpcError extends Error {
  readonly code: string;
  readonly details?: unknown;
}
```
Standard codes: `validation_error`, `unauthorized`, `forbidden`, `not_found`, `rate_limit_exceeded`, `invalid_body`, `internal_error`, `timeout`, `aborted`.
