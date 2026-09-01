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


---

## 🛠 6. Operational Guide for AI Agents

### Building Packages
To build all packages or a specific package:
```bash
# Build specific package
pnpm --filter @cellsweb/rpc-core run build
pnpm --filter @cellsweb/rpc-client run build

# Typecheck whole monorepo
pnpm --filter @cellsweb/rpc-core run typecheck
```

### Running Tests
Always run unit tests before publishing:
```bash
pnpm --filter @cellsweb/rpc-core exec vitest run
pnpm --filter @cellsweb/rpc-client exec vitest run
```

### Publishing Packages to NPM
To publish an updated package:
1. Bump version in package `package.json`.
2. Build package: `pnpm --filter <pkg> run build`.
3. Publish to NPM: `npm publish` inside `packages/<pkg>`.

---

*Maintained by Minhazur Rahman ([MinhazurSarker](https://github.com/MinhazurSarker))*
