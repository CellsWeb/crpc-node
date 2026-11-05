# CellsWeb RPC Ecosystem

> High-performance, zero-overhead RPC API framework for Node.js powered by sub-microsecond TypeBox JIT schema validation, declarative worker thread multi-processing, Busboy streaming multipart uploads, and $O(1)$ function dispatching.

---

## Workspace Packages

| Package | NPM | Role | Description |
|---|---|---|---|
| [`@cellsweb/rpc-core`](https://www.npmjs.com/package/@cellsweb/rpc-core) | [![npm](https://img.shields.io/npm/v/@cellsweb/rpc-core.svg)](https://www.npmjs.com/package/@cellsweb/rpc-core) | Core Engine | Runtime RPC engine (`CoreRPC`), TypeBox JIT compilation, multi-threading worker pool (`worker = true`), in-process test runner (`createTestCaller`), Fastify/Express adapters, and interactive docs. |
| [`@cellsweb/rpc-client`](https://www.npmjs.com/package/@cellsweb/rpc-client) | [![npm](https://img.shields.io/npm/v/@cellsweb/rpc-client.svg)](https://www.npmjs.com/package/@cellsweb/rpc-client) | Client SDK | Universal client SDK for Web, React, Next.js, and React Native / Expo with automatic multipart conversion, query race condition suppression, and typed error handling. |
| [`create-cellsweb-rpc-api`](https://www.npmjs.com/package/create-cellsweb-rpc-api) | [![npm](https://img.shields.io/npm/v/create-cellsweb-rpc-api.svg)](https://www.npmjs.com/package/create-cellsweb-rpc-api) | CLI Scaffolder | Universal framework CLI (`crpc`) and project scaffolder with AI batch code generation and security audit reporting. |

---

## Quick Start

### 1. Scaffold a New API Project

```bash
# Interactive setup (Choose between Vanilla Node.js, Express, Fastify, Ultimate-Express)
npx create-cellsweb-rpc-api@latest my-rpc-api

# Or pass framework flag directly:
npx create-cellsweb-rpc-api@latest my-rpc-api --framework express
npx create-cellsweb-rpc-api@latest my-rpc-api --framework fastify
npx create-cellsweb-rpc-api@latest my-rpc-api --framework ultimate-express
```

### 2. Start Dev Server

```bash
cd my-rpc-api
pnpm run dev
```

Dev server starts at `http://localhost:4000`. API endpoint: `POST http://localhost:4000/rpc` (or `/api`). Docs UI: `GET http://localhost:4000/docs`.

---

## Core Engine Usage (`@cellsweb/rpc-core`)

`CoreRPC` supports constructor options, instance setters, static builder, and raw HTTP listener exports:

```ts
import { CoreRPC } from "@cellsweb/rpc-core";

// Direct Constructor:
const app = new CoreRPC({
  functionsDir: "./src/functions",
  middlewaresDir: "./src/middlewares",
  port: 4000,
  rpcEndpoint: "/rpc",
  docsEndpoint: "/docs",
  healthEndpoint: "/health",
  docs: true,
  cors: true,
});

await app.start();
```

---

## Project Commands

- `pnpm run dev` (or `crpc dev`) — Start dev server with hot-reloading
- `pnpm run build` (or `crpc build`) — Compile TypeScript with production ESM resolution
- `pnpm run start` (or `crpc start`) — Start compiled production server
- `pnpm run typecheck` — Typecheck TypeScript files
- `pnpm test` (or `crpc test`) — Run Vitest unit & integration tests
- `pnpm run test:audit` (or `crpc test:audit`) — Generate client security verification audit report
- `pnpm run create:function` (or `crpc create:function`) — Interactively or batch scaffold a new RPC function + test
- `pnpm run create:middleware` (or `crpc create:middleware`) — Interactively or batch scaffold a new central middleware + test
