# AGENTS.md — CellsWeb RPC API Ecosystem Architecture, History & Agent Guide

Welcome, Agent! This document serves as the authoritative architectural blueprint, development history, core design rules, and operational guidelines for the **CellsWeb RPC Ecosystem** (`MinhazurSarker/cellsweb-rpc`).

---

## 🚀 1. Ecosystem Vision & Ambitions

**CellsWeb RPC** is a high-performance, production-ready RPC API framework for TypeScript & JavaScript applications across Node.js, Web, and Mobile (React Native / Expo).

### Why CellsWeb RPC?
- **Zero Overhead**: Eliminates bloated GraphQL/REST boilerplate while retaining strict runtime validation and full TypeScript type safety.
- **$O(1)$ Function Dispatching**: Pre-indexed namespace and function registry lookup map ensures ultra-fast request routing.
- **Single-Endpoint Architecture**: All RPC requests pass through a single `/rpc` endpoint with uniform `{ namespace, functionName, data }` payloads.
- **Unified Multipart Form-Data**: Seamlessly handles file uploads (Web `File`/`Blob` and React Native `{ uri, name, type }`) via streaming `busboy` on the backend and automatic JS Object $\rightarrow$ `FormData` conversion on the frontend.
- **Zero-Config Interactive Docs**: Server-rendered, dark-themed, live API documentation UI built directly into `@cellsweb/rpc-core` with zero third-party UI dependencies.

---

## 📦 2. Monorepo Architecture & Package Overview

This repository is managed as a monorepo containing three core packages:

```
cellsweb-rpc/
├── packages/
│   ├── rpc-core/                 # @cellsweb/rpc-core (Server Runtime Engine)
│   ├── rpc-client/               # @cellsweb/rpc-client (Client SDK & React/RN Hooks)
│   └── create-cellsweb-rpc-api/  # create-cellsweb-rpc-api (CLI Scaffolder & Boilerplate)
├── package.json
└── AGENTS.md
```

### Summary of Packages:

1. **`@cellsweb/rpc-core`** (NPM: [`@cellsweb/rpc-core`](https://www.npmjs.com/package/@cellsweb/rpc-core)):
   - Core server runtime engine (`CoreRPC`).
   - Implements $O(1)$ function registry discovery (`buildRegistry`).
   - Runtime validation using `@sinclair/typebox`.
   - Streaming multipart file upload parsing using `busboy`.
   - Options-based middleware pipeline executor.
   - Interactive server-rendered documentation engine (`/docs`).

2. **`@cellsweb/rpc-client`** (NPM: [`@cellsweb/rpc-client`](https://www.npmjs.com/package/@cellsweb/rpc-client)):
   - Universal client SDK for Web, React, Next.js, React Native, and Expo.
   - Standalone direct request function (`rawRpcRequest`) for use in providers, stores, or non-React services.
   - Client class (`createRpcClient`) with dynamic `defaultHeaders` and `defaultBody` inheritance.
   - Automatic Multipart Form-Data conversion (converts JS objects containing `File` or `{ uri, name, type }` into `FormData` with top-level `namespace` and `functionName`).
   - React hooks (`useRpcQuery`, `useRpcMutation`, `<RpcProvider>`).

3. **`create-cellsweb-rpc-api`** (NPM: [`create-cellsweb-rpc-api`](https://www.npmjs.com/package/create-cellsweb-rpc-api)):
   - CLI scaffolder (`npx create-cellsweb-rpc-api@latest my-app`).
   - Generates production-ready project template with `pino` logger, rate-limiting, environment validation (`src/env.ts`), file storage utilities, interactive generators (`pnpm create:function`, `pnpm create:middleware`), and automatic `.env` setup.

---

## ⚙️ 3. Core Architectural Rules & Design Principles

When modifying or extending any package in this codebase, **YOU MUST ADHERE TO THESE MANDATORY RULES**:

### Rule 1: Zero Hardcoding in Documentation & Contracts
- All UI documentation, schemas, parameters, and middleware controls **MUST** be dynamically inspected from code and TypeBox schemas.
- Never hardcode specific middleware names or fields in core renderers.

### Rule 2: Uniform HTTP 200 Error Protocol
- The RPC server returns **HTTP Status 200** for business/validation errors.
- Success Response:
  ```json
  { "status": "ok", "data": { ... }, "meta": { "requestId": "...", "durationMs": 1.2 } }
  ```
- Error Response:
  ```json
  { "status": "error", "code": "validation_error", "message": "...", "meta": { ... } }
  ```
- The client SDK (`@cellsweb/rpc-client`) inspects `status === "error"` and throws `RpcError`.

### Rule 3: Options-Based Middlewares
- Middlewares live in `src/middlewares/{middlewareName}/`:
  - `constants.ts`: Exports `metadata` (`{ name, description }`), `headersSchema`, and `optionsSchema`.
  - `run.ts`: Implements `MiddlewareFn<Options>`.
- Functions attach middlewares in `functions/{ns}/{fn}/middlewares.ts`:
  ```ts
  export const middlewares = defineMiddlewares([
    { name: "rateLimit", options: { windowSeconds: 60, maxRequests: 100 } },
  ]);
  ```

### Rule 4: Automatic Multipart Conversion
- The client SDK accepts standard JS objects.
- When `multipart: true` is passed, the client automatically builds `FormData`, appends `namespace` and `functionName` as top-level fields, appends primitives and file objects (Web `File`/`Blob` or React Native `{ uri, name, type }`), and omits manual `Content-Type` headers so the fetch engine appends the boundary automatically.

### Rule 5: 2-Column Split Schema Documentation
- Function detail pages (`/docs/:ns/:fn`) render:
  - **Left Column**: Human-readable field breakdown (field name, type, required/optional status, description). File fields render as `File / Binary`.
  - **Right Column**: Raw JSON Schema code block.

---

## 📜 4. Development History & Trajectory

- **Phase 1 (Origin & Extraction)**:
  - Extracted core RPC engine concepts from Iqbal Auto Parts production platform into `@cellsweb/rpc-core`.
  - Established TypeBox contract architecture and $O(1)$ tinyglobby registry loader.

- **Phase 2 (Scaffolding & Boilerplate)**:
  - Created `create-cellsweb-rpc-api` CLI scaffolder.
  - Implemented interactive CLI scripts (`pnpm create:function`, `pnpm create:middleware`).
  - Added strict environment variable validation and Pino logging.

- **Phase 3 (Documentation Engine Overhaul)**:
  - Restored and enhanced server-rendered dark theme documentation UI (`/docs`).
  - Implemented zero-hardcoding middleware card renderer with `Properties & Controls` and `Required Headers` sections.
  - Added 2-column split view for Input and Output schemas.
  - Added central middleware catalog view (`/docs/middlewares/:name`).

- **Phase 4 (Client SDK & React Hooks)**:
  - Built and published `@cellsweb/rpc-client`.
  - Added `rawRpcRequest` for direct usage outside React (e.g. `AuthProvider.tsx`).
  - Added `createRpcClient` with dynamic token/header getters.
  - Implemented automatic object $\rightarrow$ `FormData` conversion engine for Web and React Native.
  - Built React hooks (`useRpcQuery`, `useRpcMutation`, `<RpcProvider>`).

- **Phase 5 (Monorepo Rename & Open Source Alignment)**:
  - Renamed GitHub repository to [`MinhazurSarker/cellsweb-rpc`](https://github.com/MinhazurSarker/cellsweb-rpc).
  - Published `@cellsweb/rpc-core` (v1.0.6), `@cellsweb/rpc-client` (v1.0.2), and `create-cellsweb-rpc-api` (v1.0.11) to NPM.

- **Phase 6 (Enterprise Testing System, AI Batch Scaffolding & ESM Resolution)**:
  - Built direct in-process testing engine (`createTestCaller`, `app.execute`) in `@cellsweb/rpc-core` (v1.0.25).
  - Added enterprise testing harness to `create-cellsweb-rpc-api` (v1.0.16) with generic `createMockContext`, `createTestActor` security audit runner, dual-mode test database (`TEST_DB_TYPE=memory` via in-memory MongoDB vs `TEST_DB_TYPE=real`), and JSON/HTML client audit reports (`pnpm test:audit`).
  - Added non-interactive CLI flags (`--ns`, `--name`, `--middlewares`), JSON batch scaffolding (`--batch '<JSON>'`), file-based scaffolding (`--file spec.json`), and programmatic `scaffoldFunction` / `scaffoldMiddleware` exports for AI coding agents.
  - Upgraded build scripts to `tsc && tsc-alias -f` (`--resolve-full-paths`) to resolve production ESM relative import extension issues (`ERR_MODULE_NOT_FOUND`).

- **Phase 7 (Enterprise Hardening, JIT TypeCompiler, Declarative Worker Thread Pool & Monorepo Overhaul)**:
  - Remediated all P0/P1 security vulnerabilities across the monorepo: fail-closed middleware enforcement (`internal_error`), IP spoofing fix (`trustProxy`), multipart Busboy DoS & prototype pollution containment (`0o700` temp dir, stream abort, prototype keys rejection, reserved key conflict mapping), and storage traversal containment.
  - Implemented high-performance TypeBox JIT compilation via `TypeCompiler.Compile()` with `WeakMap` schema caching (<0.8µs validation speed).
  - Built declarative multi-threading Worker Thread Pool subsystem in `@cellsweb/rpc-core` (`export const worker = true;` in `constants.ts`) with pre-warmed worker threads, dynamic ESM file execution, task queueing, and automatic crash recovery.
  - Hardened `@cellsweb/rpc-client`: client signal abort checking, distinct `aborted` vs `timeout` status codes, query race condition prevention with monotonic counters, and payload multipart reserved key isolation.
  - Resolved pure Node.js ESM relative imports across templates, example app, and scaffolders by eliding type imports via `import type`.
  - Normalized monorepo root (`private: true`), purged unused dependencies, and established clean monorepo test scripts.

- **Phase 8 (Web Standards, Hono, Elysia.js & Bun Native Support)**:
  - Added native Web Standards WinterCG Fetch API support (`app.fetch(request: Request): Promise<Response>`) to `@cellsweb/rpc-core`.
  - Added first-class Hono adapters (`createHonoHandler`, `createHonoMiddleware`, `app.honoPlugin`).
  - Added first-class Elysia.js plugin (`createElysiaPlugin`, `app.elysiaPlugin`).
  - Added native Bun server support (`app.serveBun()`) and Bun CLI detection with `--watch` acceleration in `crpc`.
  - Added Web standard `request.formData()` streaming file intake with conversion to authentic `UploadedFile` instances.
  - Added scaffolding support in `create-cellsweb-rpc-api` for Hono (`-f hono`), Elysia (`-f elysia`), and Bun Native (`-f bun`).

- **Phase 9 (Universal Framework CLI & Zero-Script Project Architecture)**:
  - Consolidated `crpc` CLI and generators (`create-function`, `create-middleware`) directly into `@cellsweb/rpc-core/bin/` (and mirrored in `create-cellsweb-rpc-api/bin/`).
  - Completely purged the legacy `scripts/` folder (`create-function.ts`, `create-middleware.ts`, `scripts/tsconfig.json`) from project templates and user repositories.
  - Eliminated `@clack/prompts` from user project `devDependencies` and removed `create-cellsweb-rpc-api` as a project dependency (projects depend solely on `@cellsweb/rpc-core`).
  - Added programmatic scaffolding exports (`scaffoldFunction`, `scaffoldMiddleware`) to `@cellsweb/rpc-core`.
  - Added local script override fallback in `crpc` for 100% backward compatibility with legacy projects.

---

## 📝 5. Detailed Conversation Summary & Resolved Gotchas

This section documents the specific problems, design decisions, and solutions established in recent major development sessions:

### Gotcha 1: `pnpm approve-builds` / Ignored esbuild Scripts
- **Symptom**: Running `pnpm dev` or `pnpm create:function` inside scaffolded apps threw `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.28.1` and failed with exit code 1.
- **Fix**: Updated `bin/create.js` in `create-cellsweb-rpc-api` to generate `package.json` with `pnpm.onlyBuiltDependencies: ["esbuild"]` and `.npmrc` setting `onlyBuiltDependencies=esbuild`.

### Gotcha 2: Environment Variable Boolean Coercion
- **Symptom**: `env.ts` environment variable validation failed with `TELEMETRY_ENABLED: Expected boolean` because `.env` entries are strings (`"true"` / `"false"`).
- **Fix**: Added TypeBox boolean coercion in `src/env.ts` to convert `"true"`, `"1"`, `true` to boolean cleanly.

### Gotcha 3: Dynamic Zero-Hardcoding Middleware Cards & Fallbacks
- **Problem**: Hardcoding middleware names (like "Rate limit") in documentation renderers broke custom middlewares.
- **Solution**: Built dynamic middleware card renderer:
  - Clean static description from `metadata.description`.
  - `Properties & Controls:` bullet list displaying option key, configured runtime value (or schema default), and property description.
  - `Required Headers:` bullet list displaying HTTP header key and description.
  - Standalone central middleware pages at `/docs/middlewares/:name`.

### Gotcha 4: 2-Column Split View for Function Schemas
- **Solution**: Function detail pages render Input and Output data contracts in a 2-column grid:
  - **Left Side**: Human-readable list of required/optional data fields or form fields (displaying `File / Binary` for `format: "binary"`).
  - **Right Side**: Formatted JSON Schema code block.

### Gotcha 5: Standalone Direct API Caller (`rawRpcRequest`) vs React Provider
- **Requirement**: React components use hooks (`useRpcQuery`, `useRpcMutation`), but non-React services (like `AuthProvider.tsx`) cannot use React hooks.
- **Solution**: Created `rawRpcRequest(options)` which takes raw options (`baseUrl`, `namespace`, `functionName`, `data`, `headers`, `defaultBody`, `multipart`) directly.

### Gotcha 6: Automatic Object $\rightarrow$ `FormData` Conversion Engine
- **Requirement**: Developers want to pass standard JS objects even when uploading files.
- **Solution**: When `multipart: true` is set, `buildRpcFormData()` automatically converts JS objects into `FormData`, appends `namespace` & `functionName` as top-level fields, appends Web `File`/`Blob` and React Native `{ uri, name, type }` objects, and lets fetch append the boundary automatically.

### Gotcha 7: Auto `.env` Setup in Scaffolder
- **Solution**: `bin/create.js` automatically copies `.env.example` $\rightarrow$ `.env` during project scaffolding if `.env` does not exist.

### Gotcha 8: Deep Nested Namespace Discovery (`**/run.{ts,js}`)
- **Symptom**: Functions located in deep nested folders (e.g. `src/functions/admin/brands/list/run.ts`) were ignored because the glob pattern was hardcoded to `*/*/run.{ts,js}` (strictly 2 directory levels).
- **Fix**: Updated `packages/rpc-core/src/registry.ts` to glob `**/run.{ts,js}` and compute `namespace = parts.slice(0, -2).join(".")`, supporting arbitrarily nested namespaces like `admin.brands.list`.

### Gotcha 9: Node ESM Compiled Imports & `tsc-alias -f`
- **Symptom**: In Node.js `"type": "module"` projects, running compiled code (`node dist/server.js`) threw `ERR_MODULE_NOT_FOUND: Cannot find module '.../dist/db/connect' imported from .../dist/server.js`.
- **Cause**: TypeScript's `tsc` emits extensionless imports (e.g. `import "./db/connect"`). In native Node.js ESM, relative imports require `.js` extensions. Standard `tsc-alias` only resolves `@/*` aliases without touching relative extensionless paths.
- **Fix**: Updated build script in `create-cellsweb-rpc-api` to `tsc && tsc-alias -f` (`--resolve-full-paths`), which automatically appends `.js` to all relative imports in compiled JavaScript files.

### Gotcha 10: In-Process Test Execution & `createTestCaller`
- **Requirement**: Developers and AI agents need to write integration and security audit tests with zero network port binding and full TypeScript typing.
- **Solution**: Implemented `createTestCaller(app, defaultOptions)` and `app.execute(functionKey, payload, options)` in `@cellsweb/rpc-core`. Supports `caller.call(key, payload)` (unwraps typed data or throws `AppError`) and `caller.callRaw(key, payload)` (returns full `{ status, code, details, meta }` for status code and boundary assertions).

### Gotcha 11: Non-Interactive & Batch Scaffolding for AI Agents
- **Requirement**: AI agents and developers need to scaffold multiple functions or middlewares in a single automated command without interactive TTY prompt blocking.
- **Solution**: Upgraded `scripts/create-function.ts` and `scripts/create-middleware.ts` to support CLI flags (`--ns`, `--name`, `--middlewares`), JSON batch strings (`--batch '<JSON>'`), spec files (`--file spec.json`), and programmatic exports (`scaffoldFunction`, `scaffoldMiddleware`).

### Gotcha 12: Framework-Agnostic Request Pipeline & Fastify Pre-Parsed Bodies
- **Symptom**: Integrating `@cellsweb/rpc-core` with Fastify (or Express) via `rpcHandler(req.raw, reply.raw)` failed with `{"code":"invalid_body","message":"Request body is empty"}` because Fastify drains the incoming `http.IncomingMessage` stream into `req.body` before route handlers run.
- **Solution**: Updated `parseJsonRequest` in `@cellsweb/rpc-core` to inspect pre-parsed bodies (`req.body`, `req.rawBody`, `(req.raw as any).body`, Buffers, strings) before falling back to native stream consumption. Updated `handleApiRequest`, `buildContext`, and `CoreRPC` to support framework request/response wrappers and added `app.createFastifyPlugin()` (`rpc.fastifyPlugin()`).

### Gotcha 13: JIT TypeCompiler Validation Acceleration
- **Requirement**: Schema validation using interpreted `Value.Check()` creates excessive overhead under high throughput.
- **Solution**: Replaced interpreted schema checking with TypeBox `TypeCompiler.Compile(schema)` backed by a `WeakMap` cache in `@cellsweb/rpc-core`. JIT compiles runtime validators down to V8 TurboFan machine instructions, achieving sub-microsecond validation (<0.8µs).

### Gotcha 14: Declarative Multi-Threading via Worker Threads
- **Requirement**: CPU-bound tasks (cryptography, PDF generation, image transformation, heavy computation) block Node's single-threaded event loop.
- **Solution**: Added declarative worker support: any function can specify `export const worker = true;` in its `constants.ts`. `@cellsweb/rpc-core` spins up a pre-warmed `WorkerPool` using `node:worker_threads`, automatically loads the target handler via ESM `import()`, executes off-thread with transferable objects support, and safely marshals results back to the event loop.

### Gotcha 15: Fail-Closed Security Pipeline & IP Spoofing Prevention
- **Symptom**: Unregistered/missing middlewares were previously skipped with `continue`, running protected handlers unauthenticated (fail-open). Client IP extraction unconditionally trusted `X-Forwarded-For`.
- **Solution**: The pipeline now fails closed (`throw new AppError(INTERNAL_ERROR)`). Client IP extraction strictly requires `trustProxy: true` (or an IP whitelist) before honoring proxy headers.

### Gotcha 16: Multipart Busboy DoS & Prototype Pollution Shield
- **Symptom**: Multipart parsing lacked part limits, stream unpiping on breach, and assigned keys directly onto plain JavaScript objects.
- **Solution**: Enforced strict stream bounds (`parts: 150`, `files: 20`, `fields: 100`, `fieldSize: 1MB`), added `abortAll()` with stream destruction, created objects with `Object.create(null)`, rejected prototype pollution keys (`__proto__`, `constructor`, `prototype`), and isolated client multipart data keys (`_data_namespace`, `_data_functionName`) to eliminate routing parameter collisions.

### Gotcha 17: Pure Node.js ESM Type Import Elision
- **Symptom**: In Node.js `"type": "module"` projects, relative extensionless imports (e.g. `import { middlewares } from "./middlewares"`) caused `ERR_MODULE_NOT_FOUND` in production.
- **Solution**: Changed type-only relative imports to `import type { ... }`. Because TypeScript completely elides type imports during compilation, no runtime JavaScript import is emitted, preventing module resolution failures without requiring synthetic file extensions.

### Gotcha 18: Built-In Zero-Config CORS & Preflight Support
- **Problem**: Connecting frontend frameworks (React, Vite, Next.js) on different ports to standalone `CoreRPC` servers failed due to missing `OPTIONS` preflight handling.
- **Solution**: Added native `cors?: boolean | CorsOptions` to `CoreRPC` (defaults to `true`). Automatically intercepts `OPTIONS` requests, returning HTTP 204 with configurable `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, and `Access-Control-Max-Age`.

### Gotcha 19: Payload Shape Preservation for Arrays & Primitives
- **Symptom**: Passing array payloads (`data: ["id-1", "id-2"]`) or strings to `client.request()` inadvertently converted them into indexed objects (`{ "0": "id-1", "1": "id-2" }`) due to blanket object spreading (`{ ...defaultBody, ...data }`).
- **Solution**: Updated `rawRpcRequest` and `parseJsonRequest` to check `isPlainObject`. Only plain objects are merged with `defaultBody`. Arrays, strings, and primitives are transmitted and validated in their authentic native shapes.

### Gotcha 20: Elimination of Database Baggage (`mongodb-memory-server`)
- **Problem**: CellsWeb RPC is a pure protocol/RPC layer, yet `create-cellsweb-rpc-api` template was bundling `mongodb-memory-server` and attempting MongoDB connections in generic test setups, introducing 50MB of binary baggage and pnpm script warnings.
- **Solution**: Completely removed `mongodb-memory-server` from dependencies and `.npmrc`. Replaced MongoDB-coupled test setups with generic, clean lifecycle hooks in `src/test/setup.ts`.

### Gotcha 21: JSON Primitive & Null Top-Level Request Guard
- **Symptom**: Sending `null` or raw primitives as an HTTP JSON body caused `parsed.namespace` to throw unhandled `TypeError` inside `parseJsonRequest`, misclassifying bad client requests as internal server errors.
- **Solution**: Added `ensureValidJsonObject(parsed)` check right after `safeJsonParse`, immediately raising `invalid_body` with clear guidance.

### Gotcha 22: Worker Pool Non-Error & Primitive Throw Containment
- **Symptom**: If a function inside a worker thread executed `throw "some error"` or `throw null`, `err.message` threw `TypeError` or returned `undefined`, crashing the worker thread or concealing error details.
- **Solution**: Hardened `WORKER_SCRIPT` catch handler with polymorphic error normalization: extracting `message`, `code`, `details`, and `stack` from error objects or falling back to `String(err)`.

### Gotcha 23: Worker Pool `postMessage` Synchronous Throw Protection
- **Symptom**: If a task payload contained non-cloneable objects (Symbols, functions, uncloneable class instances), `worker.postMessage()` threw synchronously, leaving the worker stuck in `activeTasks` and orphaning the queue.
- **Solution**: Wrapped `worker.postMessage` in a `try / catch` block in `dispatchNext()`. On clone failure, the task is immediately rejected with `INTERNAL_ERROR` and the worker returns to the idle pool.

### Gotcha 24: Premature Multipart Socket Abort Leak Containment
- **Symptom**: If an uploading client disconnected before Busboy finished streaming, the `parseMultipartStream` promise could hang indefinitely and leave open write streams.
- **Solution**: Attached `rawReq.on("close")` and `rawReq.on("error")` listeners to detect premature client socket termination (`!rawReq.complete`), immediately destroying write streams, deleting temp files, and rejecting the promise cleanly.

### Gotcha 25: Strict Routing Identifier Sanitization & Path Traversal Shield
- **Symptom**: Malicious clients sending path traversal keys (`namespace: "../../../etc"`) or prototype property keys (`__proto__`, `constructor`) or null bytes `\0` were reaching registry lookups or file handlers.
- **Solution**: Extracted and centralized `validateRoutingIdentifier()` in `packages/rpc-core/src/request/routing.ts`. Enforces a 128-char limit, rejects prototype identifiers, and validates against `/^[a-zA-Z0-9_]+([.-][a-zA-Z0-9_]+)*$/`, repelling traversal and injection at 34,000+ req/sec.

### Gotcha 26: Response Double-Send & `headersSent` Guard
- **Symptom**: In high-concurrency race conditions or client socket resets, calling `responseObj.setHeader()` after headers were already committed threw unhandled `ERR_HTTP_HEADERS_SENT`.
- **Solution**: Added strict `!responseObj.headersSent` and `!responseObj.writableEnded` guards to `handleApiRequest` across both success and error response paths.

### Gotcha 27: `Value.Default` / `Value.Clone` Stripping `UploadedFile` Prototype Methods
- **Symptom**: Calling `input.file.toBuffer()` or `input.file.createReadStream()` inside function handlers threw `TypeError: input.file.toBuffer is not a function` because TypeBox's internal `Value.Clone()` during `Value.Default` stripped prototype methods from class instances.
- **Solution**: Updated `validateSchema` in `packages/rpc-core/src/utils/typebox.ts` to capture authentic `UploadedFile` instances before TypeBox operations and restore them directly onto decoded objects, and added `rehydrateFiles()` in `WORKER_SCRIPT` for multi-threaded worker functions.

### Gotcha 28: Scaffolder Scripts `tsconfig.json` ESM & `import.meta` Resolution
- **Symptom**: Opening `scripts/create-function.ts` or `scripts/create-middleware.ts` in IDEs threw `Cannot find name 'process'` and `The 'import.meta' meta-property is only allowed when '--module' is 'nodenext'`.
- **Solution**: Updated `scripts/tsconfig.json` across templates, examples, and `bin/create.js` to `"module": "nodenext"`, `"moduleResolution": "nodenext"`, and added `"types": ["node"]`. Added `@types/node` to `create-cellsweb-rpc-api` devDependencies.

### Gotcha 29: Client Signal Invalidation of Timeout & Event Listener Leak
- **Symptom**: When a caller supplied an `AbortSignal` to `rawRpcRequest`, passing `signal: userSignal ?? abortController.signal` completely superseded `abortController.signal`, rendering `timeoutMs` inoperative! Reused signals also accumulated uncleaned abort listeners.
- **Solution**: Updated `rawRpcRequest` and `sendMultipartXHR` to always supply `abortController.signal` (which listens to and forwards `userSignal` abort events), and clean up `userSignal.removeEventListener("abort", onUserAbort)` in `finally`.

### Gotcha 30: Middleware Option Default Values Discarded in Pipeline
- **Symptom**: If a middleware declared schema defaults in `optionsSchema` (e.g. `Type.Number({ default: 60 })`), `validateSchema` applied `Value.Default` but the returned value was discarded, passing raw `{}` to `run()`.
- **Solution**: Updated `packages/rpc-core/src/pipeline.ts` to assign `const validatedOptions = mwEntry.optionsSchema ? validateSchema(...) : mwOptions` and pass `options: validatedOptions` to `mwEntry.run()`.

### Gotcha 31: HTTP Headers RFC 7230 Case-Insensitive Matching
- **Symptom**: In Node.js, `req.headers` lowercases all incoming header keys. If a developer declared `headersSchema = Type.Object({ "X-API-Key": Type.String() })`, validation failed with `X-API-Key: Expected string`.
- **Solution**: Added `prepareHeadersForSchema` in `pipeline.ts` to case-insensitively map incoming header keys to declared schema properties before validation.

### Gotcha 32: Custom `docsEndpoint` Parameter Omission in `CoreRPC`
- **Symptom**: Configuring a custom `docsEndpoint: "/api-docs"` broke function documentation routing because `renderDocsHtml` was called without the 5th `docsPath` argument, defaulting to `/docs`.
- **Solution**: Passed `docsPath` to `renderDocsHtml(registry, serverUrl, rawUrl, rpcPath, docsPath)`.

### Gotcha 33: Worker Pool Date, RegExp, Buffer, and TypedArray Object Mutation
- **Symptom**: In multi-threaded worker functions, `rehydrateFiles()` traversed objects with `Object.entries(val)` without checking for instances of `Date`, `RegExp`, `Buffer`, or `ArrayBufferView`, mutating `new Date()` into `{}`.
- **Solution**: Added type guards in `rehydrateFiles()` to return `Date`, `RegExp`, `Buffer`, and TypedArray instances untouched.

### Gotcha 34: Scaffolder Non-Interactive Flags & pnpm 10 `approve-builds esbuild`
- **Symptom**: Running `create-cellsweb-rpc-api` non-interactively or with flags stopped on TTY prompts; pnpm 10 threw `[ERR_PNPM_IGNORED_BUILDS]` on `esbuild` during scaffolded installation.
- **Solution**: Added CLI flag parsing for `--yes`, `-y`, `--non-interactive`, `--pm`, `--name`, and updated install command to `pnpm install || (pnpm approve-builds esbuild && pnpm install)`.

### Gotcha 35: Pure ESM `require("node:fs")` in `UploadedFile`
- **Symptom**: Calling `file.createReadStream()` or `file.toBuffer()` in pure ESM environments crashed with `ReferenceError: require is not defined` because CommonJS `require` was dynamically called inside `UploadedFile`.
- **Solution**: Replaced dynamic `require()` calls in `packages/rpc-core/src/uploads/types.ts` with static top-level ESM imports (`import fs from "node:fs"` and `import fsPromises from "node:fs/promises"`).

### Gotcha 36: Test Log Level Flooding & CI/CD Noise
- **Symptom**: Running tests flooded the terminal and test runner output with thousands of lines of JSON logs from Pino because `level` defaulted unconditionally to `"info"`.
- **Solution**: Updated `packages/rpc-core/src/logger.ts` to detect `process.env.NODE_ENV === "test" || Boolean(process.env.VITEST)` and default to `"silent"` unless explicitly overridden via `process.env.API_LOG_LEVEL`.

### Gotcha 37: Pre-Parsed Body Edge Cases (Null / Non-Object) in `parseJsonRequest`
- **Symptom**: When integrating with Express or Fastify, if a client sent `null` or a number/boolean as JSON body, `preParsed && typeof preParsed === "object"` skipped the parsed body and fell through to stream consumption, which hung or failed because the incoming stream was already drained by the parent framework.
- **Solution**: Updated `packages/rpc-core/src/request/json.ts` to check `preParsed !== undefined` and immediately validate with `ensureValidJsonObject(preParsed)`.

### Gotcha 38: Client Root `baseUrl` Endpoint Fallback in `RpcClient`
- **Symptom**: Instantiating `createRpcClient({ baseUrl: "http://localhost:4000" })` without `rpcEndpoint` caused requests to be dispatched to `http://localhost:4000/` instead of `http://localhost:4000/rpc` because the constructor coerced `undefined` to `""`, overriding `rawRpcRequest`'s default parameter.
- **Solution**: Removed the `?? ""` coercion in `RpcClient` constructor, preserved `undefined`, and updated URL resolution in `rawRpcRequest` to ensure requests cleanly resolve to `/rpc` unless an explicit custom endpoint or non-root path is supplied.

### Gotcha 39: Fastify Plugin Configurable `healthEndpoint`
- **Symptom**: `createFastifyPlugin` hardcoded `"/health"`, ignoring custom `healthEndpoint` configuration in `CoreRpcOptions`.
- **Solution**: Made `healthEndpoint?: string` configurable in `createFastifyPlugin` and `fastifyPlugin`, falling back to `this.options.healthEndpoint ?? "/health"`.

### Gotcha 40: Prototype Key Sanitization in Client FormData and Server Rehydration
- **Symptom**: Passing prototype keys (`__proto__`, `constructor`, `prototype`) in FormData objects or worker rehydration could pollute object prototypes or bypass property lookups.
- **Solution**: Enforced `FORBIDDEN_KEYS` skipping across `buildRpcFormData()`, `validateSchema()` file restoration, and worker thread `rehydrateFiles()`.

### Gotcha 41: Bun / Web Standard MIME Type Parameter Stripping in `validateFileRules`
- **Symptom**: Creating a `Blob` in Bun with `{ type: "text/plain" }` sets its MIME type to `"text/plain;charset=utf-8"`. When schema declared `File({ mimeTypes: ["text/plain"] })`, strict equality check failed with `validation_error: File has invalid MIME type "text/plain;charset=utf-8"`.
- **Solution**: Updated `validateFileRules` in `packages/rpc-core/src/utils/typebox.ts` to strip MIME type parameters (`split(";")[0].trim().toLowerCase()`) for both the uploaded file and schema allowed types. Also normalized `detectedMime` in `web.ts` and `multipart.ts`.

### Gotcha 42: Web Standard `Request.formData()` vs Busboy Streaming Parity
- **Requirement**: In Bun and Web standards runtimes, incoming multipart requests use `request.formData()` rather than Node.js `IncomingMessage` streams.
- **Solution**: Built `parseWebRequest` in `packages/rpc-core/src/request/web.ts`, extracting Web `File` objects, writing them to secure `0o700` temp directories, and instantiating authentic `UploadedFile` class instances so handlers have identical `.toBuffer()`, `.createReadStream()`, and `.path` access across Node, Bun, and Web frameworks.

### Gotcha 43: Universal CLI Runtime Detection for Bun (`crpc`)
- **Requirement**: Developers using Bun wanted instant startup without `npx tsx` overhead.
- **Solution**: Added Bun detection (`typeof process.versions.bun !== "undefined"`) in `bin/crpc.js`. When invoked in Bun, `crpc dev` leverages native `bun --watch`, `crpc start` uses `bun`, and generator scripts execute directly via `bun` without external shims.

### Gotcha 44: Module Scope in CLI Binaries vs Library ESM (`ReferenceError: exports`)
- **Symptom**: Adding `"type": "module"` to `packages/rpc-core/package.json` caused TypeScript `NodeNext` compilation of `src/` to require `.js` extensions on 95 relative imports, while removing it caused Node to warn when executing `bin/crpc.js`.
- **Solution**: Placed an isolated `packages/rpc-core/bin/package.json` with `{ "type": "module" }`, allowing Node to execute `bin/` CLI scripts as native ESM without disrupting library TypeScript compilation.

### Gotcha 45: Dynamic Import Extension in NodeNext (`TS2835`)
- **Symptom**: In `packages/rpc-core/src/core-rpc.ts`, dynamic `await import("./scaffold")` threw `TS2835: Relative import paths need explicit file extensions in ECMAScript imports when '--moduleResolution' is 'node16' or 'nodenext'`.
- **Solution**: Statically imported `scaffoldFunction` and `scaffoldMiddleware` from `./scaffold` at top level and provided default fallback directories (`this.options.functionsDir ?? "src/functions"`).

### Gotcha 46: Web Standards Multipart Stream Flood Containment
- **Symptom**: While `busboy` in `multipart.ts` capped fields at 100 and files at 20, Web Standards `parseWebRequest` in `web.ts` only checked byte bounds, exposing the fetch pipeline to field flooding and file descriptor exhaustion.
- **Solution**: Enforced strict stream bounds in `web.ts` (`MAX_PARTS: 150`, `MAX_FIELDS: 100`, `MAX_FIELD_SIZE: 1MB`, `MAX_FILES: 20`) with automatic temp file cleanup on abort.

---

## 🛠 6. Operational Guide for AI Agents

### Building Packages
To build all packages or a specific package:
```bash
# Build specific package
pnpm --filter @cellsweb/rpc-core run build
pnpm --filter @cellsweb/rpc-client run build

# Build all packages from root
pnpm build

# Typecheck whole monorepo
pnpm typecheck
```

### Running Tests
Always run unit tests before publishing:
```bash
# Run tests across entire monorepo
pnpm test

# Run tests on specific package
pnpm --filter @cellsweb/rpc-core test
pnpm --filter @cellsweb/rpc-client test
pnpm --filter example test
```

### Publishing Packages to NPM
To publish an updated package:
1. Bump version in package `package.json`.
2. Build package: `pnpm --filter <pkg> run build`.
3. Publish to NPM: `npm publish` inside `packages/<pkg>`.

---

*Maintained by Minhazur Rahman ([MinhazurSarker](https://github.com/MinhazurSarker))*
