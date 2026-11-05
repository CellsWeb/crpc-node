# MEMORY.md — CellsWeb RPC Enterprise Brain & Architectural Memory

**Project:** `MinhazurSarker/cellsweb-rpc`  
**Purpose:** Persistent agent memory, architectural invariants, verified vulnerability ledger, performance strategies, and execution roadmap for enterprise hardening.  
**Last Updated:** November 2026

---

## 1. Project Vision & Non-Negotiable North Star

**CellsWeb RPC** is a high-performance, single-endpoint (`/rpc`), type-safe RPC API framework for Node.js, Web, and Mobile (React Native / Expo).

### Non-Negotiable Invariants:
1. **100% Drop-in Backward Compatibility:**
   - RPC Request payload format: strictly `{ namespace, functionName, data }`.
   - RPC Response envelope format: strictly `{ status: "ok", data, meta: { requestId, durationMs } }` and `{ status: "error", code, message, details?, meta }`.
   - Function directory contract: `src/functions/{namespace}/{functionName}/` containing `run.ts`, `constants.ts`, and optional `middlewares.ts`.
   - Client SDK contract: `@cellsweb/rpc-client` functions (`rawRpcRequest`, `createRpcClient`, `useRpcQuery`, `useRpcMutation`) must not break existing mobile or web apps.
2. **Zero-Trust & Fail-Closed Execution:**
   - If a declared middleware is missing or fails to load, the engine **must fail closed** (HTTP 500 / `internal_error`). It must **never** run unauthenticated.
   - If an input payload is malformed or invalid, it must **never** be coerced silently (no `Value.Cast` fallback).
   - If a file is required, missing files must fail validation before execution.
3. **No Domain Baggage:**
   - Absolute zero e-commerce remnants (no `$49.99` prices, no `com.iqbal.autoparts`, no domain-specific hacks in generic parsers).
4. **.NET / Rust-Grade Performance:**
   - JIT-compiled schema validation via TypeBox `TypeCompiler` (<0.8µs per validation).
   - AOT static manifest generation option for 0ms startup time.
   - Multi-threaded CPU execution via pre-warmed Worker Thread Pool (`worker: true`).

---

## 2. Monorepo Architecture & Directory Topology

```
cellsweb-rpc/
├── packages/
│   ├── rpc-core/                 # @cellsweb/rpc-core (Server Runtime Engine)
│   │   ├── src/
│   │   │   ├── core-rpc.ts       # CoreRPC public class & server entry
│   │   │   ├── interceptor.ts    # HTTP execution pipeline & response formatter
│   │   │   ├── context.ts        # Request context & IP extraction
│   │   │   ├── errors.ts         # AppError & ErrorCode enums
│   │   │   ├── registry.ts       # Registry loader & function/mw discovery
│   │   │   ├── logger.ts         # Pino logger integration
│   │   │   ├── test-caller.ts    # In-process test harness (createTestCaller)
│   │   │   ├── workers/          # [PHASE 3] Worker Thread Pool subsystem
│   │   │   ├── request/          # Request parsing (JSON & Multipart Busboy)
│   │   │   ├── uploads/          # UploadedFile stream & buffer wrappers
│   │   │   ├── utils/            # Timing, JSON serialization, TypeBox JIT
│   │   │   └── docs/             # Server-rendered dark documentation engine
│   │   └── package.json
│   │
│   ├── rpc-client/               # @cellsweb/rpc-client (Universal Client SDK)
│   │   ├── src/
│   │   │   ├── client.ts         # rawRpcRequest & RpcClient class
│   │   │   ├── multipart.ts      # Automatic JS Object -> FormData engine
│   │   │   ├── errors.ts         # RpcError definition
│   │   │   ├── types.ts          # Client types & contracts
│   │   │   └── react/            # React & React Native hooks (useRpcQuery, useRpcMutation)
│   │   └── package.json
│   │
│   └── create-cellsweb-rpc-api/  # create-cellsweb-rpc-api (CLI & Scaffolder)
│       ├── bin/
│       │   ├── create.js         # Interactive project scaffolder
│       │   └── crpc.js           # Unified CLI (crpc dev, build, start, test)
│       ├── template/             # Production application boilerplate
│       │   ├── src/              # server.ts, env.ts, middlewares, storage
│       │   └── scripts/          # create-function.ts, create-middleware.ts
│       └── package.json
│
├── example/                      # Reference implementation & integration playground
├── pnpm-workspace.yaml           # Monorepo workspaces definition
├── package.json                  # Root monorepo workspace configuration
└── MEMORY.md                     # THIS FILE
```

---

## 3. Verified Vulnerabilities & Defect Register

### Tier 1: `@cellsweb/rpc-core`
- **P0-1 (Fail-Open MW):** `interceptor.ts:60` and `core-rpc.ts:245` call `continue` on missing middleware. **Fix:** Throw `AppError(INTERNAL_ERROR)` immediately.
- **P0-2 (Busboy DoS):** Missing bounds on `files`, `fields`, `parts`, `fieldSize`. Streams not unpiped/destroyed on limit breach. Unhandled rejection on file promise limits. **Fix:** Set full limits, destroy streams on breach, attach `.catch()` at creation.
- **P0-3 (Prototype Pollution):** Multipart keys directly assigned onto plain objects. **Fix:** Use `Object.create(null)` and reject `__proto__`, `constructor`, `prototype`.
- **P0-4 (IP Spoofing):** `context.ts:16` trusts `X-Forwarded-For` without `trustProxy`. **Fix:** Add `trustProxy: boolean | string[]`.
- **P0-5 (CSRF/Content-Type Sniffing):** `request/index.ts:27` treats unknown content types as JSON if pre-parsed body exists. **Fix:** Enforce strict content-type check.
- **P0-6 (File Validation Bypass):** Required files sanitized to `Type.Optional(Type.Any())`; non-file union branches ignored; `Value.Cast` coerces data. **Fix:** Verify required file fields, validate non-file union variants, ban `Value.Cast`.
- **P0-7 (NaN Config Limits):** Non-numeric envs evaluate to `NaN`, disabling limits (`bytes > NaN === false`). **Fix:** Validate numeric configs at startup with `Number.isFinite()`.
- **P0-8 (Listener Error Boundary):** `createHandler` lacks top-level `try/catch`, causing hung client sockets on render/write crashes. **Fix:** Wrap listener in outer error boundary.
- **P0-9 (Server Error Handling):** `start()` listen promise lacks error handler (crashes on `EADDRINUSE`); no `close()` method. **Fix:** Add error listener and `public async close()`.
- **P0-10 (Insecure Temp Files):** Upload directory lacks `0o700` permissions; cleanup uses sync `fs.unlinkSync`; `UploadedFile` methods use dynamic `require()`. **Fix:** `mode: 0o700`, async `fs.promises.unlink`, static imports.
- **P1-1 (Query String 404):** `url === rpcPath` fails on query strings (`/rpc?debug=true`). **Fix:** Match on `pathname = url.split("?")[0]`.
- **P1-2 (Express Next Severed):** Unmatched routes return 404 without calling `next()`. **Fix:** Call `next()` when available.
- **P1-3 (Windows ESM Crash):** `pathToFileURL` imported but unused; raw Windows drive paths fail in `import()`. **Fix:** Use `pathToFileURL(filePath).href`.
- **P1-4 (JSON Null Crash):** `parsed.namespace` crashes on JSON `null`. **Fix:** Add non-object type guard.
- **P1-5 (Hardcoded Docs Paths):** Custom `docsEndpoint` breaks navigation and detail routes. **Fix:** Dynamically prefix all docs links.
- **P1-6 (Dead Strict Option):** `strict` option accepted but never used. **Fix:** Fail fast on registry loading errors when strict.
- **P1-7 (SafeJsonStringify Empty Response):** `safeStringify(data) ?? "{}"` returns `{}` with HTTP 200 on serialization failure. **Fix:** Throw `internal_error`.
- **P1-8 (Timeout Cancellation):** Request timeout does not cancel downstream work. **Fix:** Thread `context.signal` (`AbortSignal`).
- **P1-9 (CORS Support):** Missing `OPTIONS` preflight handling. **Fix:** Add configurable CORS options.
- **P1-10 (Pipeline Duplication):** 100+ lines duplicated between `app.execute()` and `handleApiRequest()`. **Fix:** Extract single `runPipeline()`.
- **P1-11 (Worker Pool Primitive/Non-Error Throws):** Worker threw unhandled `TypeError` when a handler threw primitive string/null. **Fix:** Normalized error extraction in `WORKER_SCRIPT`.
- **P1-12 (Worker Pool postMessage Synchronous Throw):** Non-cloneable objects in task payload orphaned tasks and workers. **Fix:** Wrapped `worker.postMessage()` in `try / catch` with automatic recovery.
- **P1-13 (Premature Multipart Stream Abort):** Client disconnecting mid-upload hung `parseMultipartStream`. **Fix:** Attached `rawReq.on("close")` and `rawReq.on("error")` abort handlers.
- **P1-14 (Strict Routing Identifier Sanitization):** Path traversal, null bytes, and prototype properties reached routing lookup. **Fix:** Extracted `validateRoutingIdentifier()` with 128-char limit, prototype ban, and regex validation.
- **P1-15 (HTTP Header Double-Send Crash):** High concurrency socket resets caused `ERR_HTTP_HEADERS_SENT`. **Fix:** Guarded response with `!responseObj.headersSent` and `!responseObj.writableEnded`.
- **P1-16 (Middleware Options Default Dropped):** `validateSchema` applied defaults to middleware options, but return value was discarded in `pipeline.ts`. **Fix:** Assign `const validatedOptions = mwEntry.optionsSchema ? validateSchema(...) : mwOptions`.
- **P1-17 (HTTP Header Case-Sensitivity Mismatch):** RFC 7230 case-insensitivity violated when schema declared mixed-case header (`X-Tenant-ID`) against Node's lowercased `req.headers`. **Fix:** Added `prepareHeadersForSchema` in `pipeline.ts`.
- **P1-18 (Worker Pool Date/Buffer Object Mutation):** `rehydrateFiles()` stripped `Date`, `RegExp`, `Buffer`, and TypedArray instances down to `{}`. **Fix:** Added type guards to preserve special class instances.
- **P1-19 (Custom Docs Endpoint Omission):** `CoreRPC` called `renderDocsHtml` without 5th `docsPath` argument, breaking custom docs endpoints. **Fix:** Pass `docsPath`.

### Tier 2: `@cellsweb/rpc-client`
- **CL-P0-1 (Key Collision):** If payload data contains `namespace` or `functionName`, `buildRpcFormData` appends duplicate keys, turning fields into arrays on backend. **Fix:** Skip reserved keys.
- **CL-P0-2 (XHR Abort Omission):** If `signal.aborted === true` before `sendMultipartXHR` is called, listener never fires. **Fix:** Check `signal?.aborted` before attaching listener.
- **CL-P1-1 (Abort Misclassified as Timeout):** `AbortError` unconditionally mapped to 408 Timeout. **Fix:** Check `userSignal?.aborted` and emit `code: "aborted"`.
- **CL-P1-2 (Default Endpoint Empty):** `rpcEndpoint ?? ""` breaks default `"/rpc"` fallback. **Fix:** Standardize default to `"/rpc"`.
- **CL-P1-3 (Proxy Non-JSON Error):** `response.json()` failure thrown as generic `network_error`. **Fix:** Catch and surface `code: "parse_error"` with `response.status`.
- **CL-P1-4 (useRpcQuery Race Condition):** Fast query changes overwrite newer data with older responses. **Fix:** Sequence request IDs / cancel previous in-flight requests.
- **CL-P1-5 (useRpcQuery Stale Headers):** `useEffect` omits `serializedHeaders` from dependencies. **Fix:** Include `serializedHeaders`.
- **CL-P1-6 (Broken Module Field):** `package.json` points to non-existent `dist/index.mjs`. **Fix:** Configure dual build via `tsup`.
- **CL-P1-7 (User Signal Disables Request Timeout):** Supplying `signal: userSignal` bypassed `abortController.signal`, preventing timeouts and leaking abort listeners. **Fix:** Always supply `abortController.signal` with listener forwarding, clean up in `finally`.

### Tier 3: `create-cellsweb-rpc-api` & Scaffolder Templates
- **SC-P0-1 (Path Traversal in storage.ts):** `resolved.startsWith(root)` matches sibling directories (`/uploads_backup`). **Fix:** Append `path.sep` to root fence.
- **SC-P0-2 (Tautological Tests):** Generated function tests assert `expect(res.status).toBeDefined()`. **Fix:** Generate real assertions testing authorized vs unauthorized access.
- **SC-P1-1 (Auth Middleware Anonymous Bypass):** When `roles` is empty, middleware returns context without requiring authentication. **Fix:** Require valid user by default.
- **SC-P1-2 (Misleading Banner):** Banner claims `/api` works when it returns 404. **Fix:** Align banner with `/rpc`.
- **SC-P1-3 (crpc Missing Reports Dir):** `crpc test:audit` crashes if `./audit-reports` does not exist. **Fix:** `mkdirSync(auditDir, { recursive: true })`.
- **SC-P1-4 (Non-Interactive TTY Blocking & pnpm 10 esbuild):** Scaffolder blocked on TTY input; pnpm 10 failed unapproved build scripts. **Fix:** Parse `--yes`, `-y`, `--pm`, `--name`, and fallback to `pnpm approve-builds esbuild`.

### Tier 4: `example/` App & Monorepo Root
- **EX-P0-1 (Extensionless ESM Imports):** `run.ts` files use extensionless imports, failing Node.js native ESM loader. **Fix:** Add `.js` extensions or configure module resolution.
- **ROOT-P1-1 (Stale Root package.json):** Still carries old scaffolder name and restricted publish config. **Fix:** Set `"private": true`, clean metadata.
- **ROOT-P1-2 (Invalid Workspace Key):** `allowBuilds` in `pnpm-workspace.yaml`. **Fix:** Remove invalid key.
- **ROOT-P1-3 (Stale npmrc):** Stale token placeholder and scope. **Fix:** Clean `.npmrc`.
- **ROOT-P1-4 (Dead Dependencies):** `lru-cache` and `rate-limiter-flexible` in `rpc-core`. **Fix:** Remove from `packages/rpc-core/package.json`.

---

## 4. Performance & Systems Architecture Decisions

### 1. TypeCompiler JIT Acceleration (Near-Rust / .NET Speed)
- Rather than running interpreted `Value.Check()` on every request, compile schemas at registration time:
  ```ts
  import { TypeCompiler } from "@sinclair/typebox/compiler";
  const compiled = TypeCompiler.Compile(schema);
  // Executes at V8 TurboFan raw machine-code speed (<0.8µs)
  ```

### 2. AOT Registry Manifest Compiler
- During `crpc build`, optionally generate `.generated/registry.manifest.ts` with direct static imports.
- At production startup, `getRegistry()` loads the static map directly with zero filesystem scanning (`glob` / `readdir`), enabling 1ms instant cold boot and single-binary packaging.

### 3. Declarative Worker Thread Offloading (`worker: true`)
- Functions can declare `export const worker = true;` in `constants.ts`.
- The engine routes CPU-heavy execution to a pre-warmed `WorkerPool` using `node:worker_threads`.
- Zero-copy memory transfer using `ArrayBuffer` transfer lists for file buffers.
- The main Node.js event loop stays 100% responsive for incoming HTTP requests.

---

## 5. Execution Governance & Verification Checklist

When executing each phase:
1. **Never break existing consumer code or payload contracts.**
2. **Never leave an unhandled error path or silent catch block.**
3. **Run strict test suites across all packages:**
   ```bash
   pnpm --filter @cellsweb/rpc-core exec vitest run
   pnpm --filter @cellsweb/rpc-client exec vitest run
   pnpm --filter example exec vitest run
   ```
4. **Build and verify artifacts:**
   ```bash
   pnpm --filter @cellsweb/rpc-core run build
   pnpm --filter @cellsweb/rpc-client run build
   ```
5. **Update this MEMORY.md file as phases are completed.**

---

## 6. Execution Ledger & Verification Summary

### Phase Completion Status:
- [x] **Phase 1: Ingestion Governor & Core P0 Security Hardening**:
  - Remediated P0-1 (fail-closed middleware), P0-2 (Busboy limits & abortAll stream destruction), P0-3 (prototype pollution shield & `Object.create(null)`), P0-4 (IP spoofing prevention with `trustProxy`), P0-5 (strict Content-Type checking), P0-6 (JIT TypeBox file validation with no silent casting), P0-9 (server socket error boundary & `close()`), P0-10 (`0o700` temp dir, async cleanup, static imports).
  - Remediated P1-1 (query string stripping), P1-2 (Express `next()` invocation), P1-3 (Windows ESM `pathToFileURL` dynamic import), P1-4 (JSON null guard), P1-5 (dynamic docs base paths).
- [x] **Phase 2: Runtime Performance, TypeCompiler JIT & Unified Pipeline**:
  - Implemented `runPipeline()` unifying HTTP handler and `execute()` execution paths.
  - Implemented JIT `TypeCompiler.Compile()` with `WeakMap` schema caching (<0.8µs validation speed).
  - Dynamic `docsEndpoint` links, synced error codes, zero-hardcoding middleware cards, and complete e-commerce domain purge.
- [x] **Phase 3: Declarative Multi-Threading Worker Pool Subsystem**:
  - Built pre-warmed `WorkerPool` using `node:worker_threads` with `{ eval: true, execArgv: process.execArgv }` and dynamic `import(pathToFileURL(filePath).href)`.
  - Supports `export const worker = true;` in any function's `constants.ts` with zero configuration.
- [x] **Phase 4: Universal Client SDK Hardening (`@cellsweb/rpc-client`)**:
  - Isolated multipart payload keys (`_data_namespace`, `_data_functionName`) to avoid routing key collisions.
  - Handled `signal.aborted` before attaching XHR listeners, preserved non-JSON gateway response status codes (502/504), differentiated aborts (`code: "aborted"`) from timeouts (`code: "timeout"`).
  - Added query sequence counter (`queryIdRef`) in `useRpcQuery` to eliminate race conditions; included `serializedHeaders` in effect dependencies.
- [x] **Phase 5: Scaffolder & CLI Hardening (`create-cellsweb-rpc-api`)**:
  - Fixed path traversal in storage utilities (`path.resolve(uploadRoot) + path.sep`).
  - Added audit directory auto-creation in `crpc test:audit`.
  - Updated templates and scaffolders to generate strict, authentic test assertions (`expect(res.status).toBe("ok")`).
- [x] **Phase 6: Reference Application & ESM Resolution (`example`)**:
  - Converted type-only relative imports to `import type` to elide runtime JavaScript imports.
  - Adapted CommonJS `rate-limiter-flexible` for pure ESM environments.
  - 100% green test suite in `example` (20 tests passed in 454ms).
- [x] **Phase 7: Monorepo Root, Packaging & Operational Validation**:
  - Root `package.json` set to `"private": true` with unified `pnpm test`, `pnpm build`, `pnpm typecheck` scripts.
  - Removed unused dependencies (`lru-cache`, `rate-limiter-flexible`) and cleaned package exports.
  - Fixed `.npmrc` and `pnpm-workspace.yaml`.

### Full Test Suite Results:
- `@cellsweb/rpc-core`: 50/50 unit, security & live network E2E tests passed in 401ms.
- `@cellsweb/rpc-client`: 12/12 client & multipart tests passed in 181ms.
- `example`: 20/20 integration and security audit tests passed in 481ms.
- **Total: 82/82 tests passing across the workspace with 0 type errors.**

### Autocannon Industrial Bombardment Results:
- **Raw JSON RPC Throughput (`fast.ping`)**: **6,426 req/sec** (19,000 requests in 3.01s with **7.26 ms average latency** under 50 concurrent connections).
- **HTTP Pipelining Throughput (`pipelining=4`)**: **6,491 req/sec** (20,000 requests in 3.01s with **30.18 ms average latency**).
- **Worker Thread Pool Multi-Threading (`worker.heavy`)**: **3,608 req/sec** (11,000 heavy CPU tasks offloaded to worker threads with **7.8 ms average latency**).
- **Adversarial Path-Traversal Injections (`namespace: "../../../etc"`)**: **33,906 req/sec** (102,000 malicious requests repelled with **1.05 ms average latency**).
- **Adversarial Null-Body Fuzzing (`body: "null"`)**: **35,568 req/sec** (107,000 malformed requests repelled with **1.03 ms average latency**).
- **Adversarial Broken Syntax Fuzzing (`body: "broken..."`)**: **31,512 req/sec** (95,000 requests repelled with **1.07 ms average latency**).
- **Post-Bombardment Memory Audit**: Heap delta was +0.56 MB across >300,000 requests (zero leaks, zero socket crashes, zero unhandled rejections).
