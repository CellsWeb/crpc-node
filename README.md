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

## 📊 Battle-Tested Node & Bun Benchmarks

Reproducible benchmark harness available in [`benchmarks/`](./benchmarks). Tested in **triplicate** across Node.js v24 and Bun v1.3 on Apple Silicon M-series hardware (macOS Darwin arm64) connected to live PostgreSQL 16.

### 1. Throughput & Latency Matrix (50,000 Requests, 100 Concurrency)

| Framework / Adapter | Runtime Engine | Throughput (Req/sec) | Avg Latency | p50 Latency | p99 Latency | Memory (RSS) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`bun:serve`** | **Bun v1.3.1 (Native Fetch)** | **8,741.3 req/s** | **11.40 ms** | **11.17 ms** | **14.92 ms** | **94.2 MB** |
| **`bun:elysia`** | **Bun v1.3.1 (Elysia Plugin)** | **8,703.6 req/s** | **11.45 ms** | **11.37 ms** | **14.30 ms** | **98.6 MB** |
| **`bun:hono`** | **Bun v1.3.1 (Hono on Bun)** | **8,609.4 req/s** | **11.58 ms** | **11.40 ms** | **14.23 ms** | **96.4 MB** |
| **`node:fastify`** | **Node.js v24.2 (Fastify Plugin)** | **6,428.7 req/s** | **15.51 ms** | **15.15 ms** | **18.65 ms** | **142.1 MB** |
| **`node:http`** | **Node.js v24.2 (Native HTTP)** | **6,450.0 req/s** | **15.46 ms** | **15.10 ms** | **19.66 ms** | **148.8 MB** |
| **`node:ultimate-express`** | **Node.js v24.2 (uWebSockets.js)** | **6,295.1 req/s** | **15.84 ms** | **15.49 ms** | **19.62 ms** | **138.4 MB** |
| **`node:express`** | **Node.js v24.2 (Express)** | **6,297.1 req/s** | **15.84 ms** | **15.54 ms** | **18.88 ms** | **153.4 MB** |

### 2. Real-World Database Operations (Live PostgreSQL 16)

| Framework / Adapter | Runtime | DB Read (`items.list` 20 items) | Read Latency | DB Write (`items.create` INSERT) | Write Latency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`bun:serve`** | **Bun v1.3.1** | **4,517.6 req/s** | **11.02 ms** | **7,882.0 req/s** | **6.28 ms** |
| **`bun:elysia`** | **Bun v1.3.1** | **4,465.4 req/s** | **11.15 ms** | **7,966.3 req/s** | **6.21 ms** |
| **`bun:hono`** | **Bun v1.3.1** | **4,342.7 req/s** | **11.47 ms** | **7,687.9 req/s** | **6.44 ms** |
| **`node:fastify`** | **Node.js v24.2** | **3,935.4 req/s** | **12.65 ms** | **5,853.9 req/s** | **8.46 ms** |
| **`node:http`** | **Node.js v24.2** | **3,894.1 req/s** | **12.79 ms** | **5,945.4 req/s** | **8.33 ms** |
| **`node:ultimate-express`** | **Node.js v24.2** | **3,812.9 req/s** | **13.06 ms** | **5,829.9 req/s** | **8.50 ms** |
| **`node:express`** | **Node.js v24.2** | **3,846.3 req/s** | **12.95 ms** | **5,857.4 req/s** | **8.45 ms** |

### 3. Real Multipart File Uploads (Disk Storage & DB Persistence)

Tested with real production files: `Screenshot.png` (191 KB) & `RideRough.pdf` (29 KB) saved to disk with metadata inserted into PostgreSQL:

| Framework / Adapter | Runtime | PNG Image Upload (191 KB) | PNG Avg Latency | PDF Document Upload (29 KB) | PDF Avg Latency | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`bun:hono`** | **Bun v1.3.1** | **2,059.4 uploads/s** | **4.82 ms** | **2,249.8 uploads/s** | **4.38 ms** | **HTTP 200 (Verified)** |
| **`bun:elysia`** | **Bun v1.3.1** | **1,901.2 uploads/s** | **5.21 ms** | **2,504.4 uploads/s** | **3.91 ms** | **HTTP 200 (Verified)** |
| **`bun:serve`** | **Bun v1.3.1** | **1,828.9 uploads/s** | **5.54 ms** | **2,448.9 uploads/s** | **4.00 ms** | **HTTP 200 (Verified)** |
| **`node:http`** | **Node.js v24.2** | **1,009.1 uploads/s** | **10.02 ms** | **1,540.9 uploads/s** | **6.54 ms** | **HTTP 200 (Verified)** |
| **`node:express`** | **Node.js v24.2** | **1,087.4 uploads/s** | **9.13 ms** | **1,318.3 uploads/s** | **7.55 ms** | **HTTP 200 (Verified)** |

### 🛡️ Attack Survival & Fuzzing Suite

- **Concurrency Saturation**: 2,000 active concurrent connections sustained with 0 socket resets.
- **Rate Limit Flooding**: Flooded with 2,000 requests in <0.04s. Exactly 100 allowed (HTTP 200), 1,900 repelled (HTTP 429), 0 server crashes.
- **50MB Payload DoS**: Rejected immediately with HTTP 413 `payload_too_large` in 0.12 ms.
- **Prototype Pollution Shield**: Attacked with `{"__proto__":{"polluted":true}}`; object prototypes completely isolated (`Object.create(null)`).
- **Path Traversal Probing**: Probed with `namespace: "../../../etc/passwd"`; rejected in 0.02 ms via strict routing regex.
- **Unauthenticated Mutation**: `items.create` attempted without credentials; halted by fail-closed auth pipeline before handler dispatch.

For full reproduction commands and live documentation, see [docs/benchmarks.md](./docs/benchmarks.md) or [online documentation](https://cellsweb.github.io/crpc-node/benchmarks/).

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
