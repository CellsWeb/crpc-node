# CellsWeb RPC Ecosystem

> High-performance, zero-overhead RPC API framework for Node.js powered by TypeBox schema validation, Busboy multipart streaming, and $O(1)$ function dispatching.

---

## Workspace Packages

| Package | NPM | Role | Description |
|---|---|---|---|
| [`@cellsweb/rpc-core`](https://www.npmjs.com/package/@cellsweb/rpc-core) | [![npm](https://img.shields.io/npm/v/@cellsweb/rpc-core.svg)](https://www.npmjs.com/package/@cellsweb/rpc-core) | Core Engine | Runtime RPC engine (`CoreRPC`), TypeBox file validators (`File()`, `Files()`), Fastify plugin adapter, and docs renderer. |
| [`@cellsweb/rpc-client`](https://www.npmjs.com/package/@cellsweb/rpc-client) | [![npm](https://img.shields.io/npm/v/@cellsweb/rpc-client.svg)](https://www.npmjs.com/package/@cellsweb/rpc-client) | Client SDK | Universal client SDK for Web, React, Next.js, and React Native / Expo with automatic multipart conversion. |
| [`create-cellsweb-rpc-api`](https://www.npmjs.com/package/create-cellsweb-rpc-api) | [![npm](https://img.shields.io/npm/v/create-cellsweb-rpc-api.svg)](https://www.npmjs.com/package/create-cellsweb-rpc-api) | CLI Scaffolder | Official CLI (`npm create cellsweb-rpc-api`) that scaffolds production-ready RPC API boilerplates. |

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
  docs: true,
});

await app.start();
```

---

## Project Commands

- `pnpm run dev` — Start dev server with hot-reloading
- `pnpm run typecheck` — Typecheck TypeScript files
- `pnpm test` — Run Vitest unit & integration tests
- `pnpm run create:function` — Interactively scaffold a new RPC function + test
- `pnpm run create:middleware` — Interactively scaffold a new central middleware + test
