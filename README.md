<p align="center">
  <a href="https://cellsweb.com" target="_blank" rel="noopener noreferrer">
    <img src="https://cellsweb.com/logo.svg" alt="CellsWeb Logo" width="340" style="background: rgba(255, 255, 255, 0.96); padding: 16px 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08); display: inline-block; max-width: 100%;" />
  </a>
</p>

<p align="center">
  <strong>High-Performance RPC API Framework for Node.js, Bun & TypeScript</strong><br>
  <a href="https://cellsweb.com">🌐 Official Website</a> •
  <a href="https://cellsweb.github.io/crpc-node/">📖 Node Engine Docs</a> •
  <a href="https://cellsweb.github.io/crpc-go/">📖 Go Engine Docs</a> •
  <a href="https://github.com/CellsWeb">🏛️ GitHub Organization</a>
</p>

# CellsWeb RPC Ecosystem (`crpc-node`)

> High-performance, zero-overhead RPC API framework for Node.js & Bun powered by sub-microsecond TypeBox JIT schema validation, declarative worker thread multi-processing, Web Standards WinterCG Fetch API, Busboy streaming multipart uploads, and $O(1)$ function dispatching.

---

## Workspace Packages

| Package | NPM | Role | Description |
|---|---|---|---|
| [`@cellsweb/rpc-core`](https://www.npmjs.com/package/@cellsweb/rpc-core) | [![npm](https://img.shields.io/npm/v/@cellsweb/rpc-core.svg)](https://www.npmjs.com/package/@cellsweb/rpc-core) | Core Engine | Runtime RPC engine (`CoreRPC`), TypeBox JIT compilation, multi-threading worker pool (`worker = true`), in-process test runner (`createTestCaller`), Fastify/Express/Hono/Elysia adapters, native Bun support (`app.serveBun()`), and interactive docs. |
| [`@cellsweb/rpc-client`](https://www.npmjs.com/package/@cellsweb/rpc-client) | [![npm](https://img.shields.io/npm/v/@cellsweb/rpc-client.svg)](https://www.npmjs.com/package/@cellsweb/rpc-client) | Client SDK | Universal client SDK for Web, React, Next.js, and React Native / Expo with automatic multipart conversion, query race condition suppression, and typed error handling. |
| [`create-cellsweb-rpc-api`](https://www.npmjs.com/package/create-cellsweb-rpc-api) | [![npm](https://img.shields.io/npm/v/create-cellsweb-rpc-api.svg)](https://www.npmjs.com/package/create-cellsweb-rpc-api) | CLI Scaffolder | Universal framework CLI (`crpc`) and project scaffolder with AI batch code generation, security audit reporting, and multi-framework support (Node, Express, Fastify, Ultimate-Express, Hono, Elysia, Bun). |

---

## ⚖️ CellsWeb RPC vs The Alternatives

| Capability / Feature | CellsWeb RPC (`crpc`) | Connect-RPC | tRPC | Twirp |
| :--- | :--- | :--- | :--- | :--- |
| **Go & TypeScript Parity** | **Yes** (100% interoperable wire format) | Yes (via Protobuf) | No (TypeScript/JS only) | Yes (via Protobuf) |
| **Zero-Codegen Client** | **Yes** (Dynamic client SDK, no build step) | No (Requires `buf generate`) | Yes (TypeScript types only) | No (Requires `protoc`) |
| **Single Endpoint (`/rpc`)** | **Yes** (Unified routing & proxy configuration) | No (Endpoint per RPC method) | No (Endpoint per procedure) | No (Endpoint per method) |
| **Zero-Config Live Docs UI** | **Yes** (Server-rendered dark theme `/docs`) | No (Requires third-party tools) | No (Third-party OpenAPI) | No |
| **Multipart File Streaming** | **Yes** (Streaming intake, Web & RN objects) | Complex (bytes in proto payload) | Complex (Custom FormData) | Complex (bytes in proto) |
| **In-Process Testing Engine** | **Yes** (`createTestCaller` / zero socket) | No (Requires network listener) | Yes (caller) | No (Network listener) |
| **Dual HTTP Status Mode** | **Yes** (Uniform 200 or standard APM codes) | No (gRPC status codes) | No (HTTP error codes) | No (HTTP error codes) |
| **Worker Multi-Threading** | **Yes** (Declarative `worker = true;`) | No | No | No |

---

## 📊 Battle-Tested Multi-Engine Benchmarks

Reproducible benchmark harness available in [`benchmarks/`](./benchmarks).

Tested on Apple Silicon M-series (macOS Darwin arm64) using `oha` with 50,000 requests at 100 concurrency:

| Engine / Runtime | Environment | Throughput (Req/sec) | Avg Latency | p99 Latency | RSS Memory |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`crpc-go` (fasthttp + JSON v2)** | **Go 1.27 (Host Native)** | **89,719 req/s** | **1.08 ms** | **2.67 ms** | **36.8 MiB** |
| **`crpc-go` (fasthttp + JSON v2)** | **Docker 4 CPUs, 4GB RAM** | **67,171 req/s** | **1.48 ms** | **2.94 ms** | **12.6 MiB** |
| **`crpc-go` (fasthttp + JSON v2)** | **Docker 1 CPU, 256MB RAM** | **53,592 req/s** | **1.83 ms** | **3.89 ms** | **12.4 MiB** |
| **`crpc-node` (`bun.serve`)** | **Bun v1.3.1 (Native Fetch)** | **7,236 req/s** | **13.75 ms** | **27.60 ms** | **94.2 MiB** |
| **`crpc-node` (`elysiaPlugin`)** | **Bun v1.3.1 (Elysia.js)** | **6,840 req/s** | **14.54 ms** | **28.40 ms** | **98.6 MiB** |
| **`crpc-node` (`fastifyPlugin`)** | **Node.js v24.2 (Fastify)** | **6,199 req/s** | **16.04 ms** | **31.10 ms** | **142.1 MiB** |
| **`crpc-node` (`node:http`)** | **Node.js v24.2 (Native HTTP)** | **6,187 req/s** | **16.06 ms** | **30.90 ms** | **148.8 MiB** |
| **`crpc-node` (`express`)** | **Node.js v24.2 (Express)** | **6,016 req/s** | **16.53 ms** | **32.80 ms** | **153.4 MiB** |
| **`crpc-node` (`honoPlugin`)** | **Node.js v24.2 (Hono)** | **5,622 req/s** | **17.69 ms** | **33.70 ms** | **158.2 MiB** |

For full reproduction commands and attack reports, see [benchmarks/RESULTS.md](./benchmarks/RESULTS.md).

---

## Quick Start

### 1. Scaffold a New API Project

```bash
# Interactive setup (Choose Node.js, Express, Fastify, Ultimate-Express, Hono, Elysia, Bun)
npx create-cellsweb-rpc-api@latest my-rpc-api

# Or pass framework flag directly:
npx create-cellsweb-rpc-api@latest my-rpc-api --framework hono
npx create-cellsweb-rpc-api@latest my-rpc-api --framework elysia
bun create cellsweb-rpc-api@latest my-rpc-api --framework bun
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
