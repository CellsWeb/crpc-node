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

Reproducible benchmark harness available in [`benchmarks/`](./benchmarks). Tested in **triplicate** on Apple Silicon M-series hardware (macOS Darwin arm64 / Linux Docker arm64) connected to live PostgreSQL 16.

### 1. Throughput & Latency Matrix (50,000 Requests, 100 Concurrency)

| Framework / Engine | Runtime | Environment / Hardware | Ping Baseline (RPS) | Ping Avg (ms) | Ping p50 (ms) | Ping p99 (ms) | RSS Memory (MB) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`crpc-go` (fasthttp)** | **Go 1.27.4** | **Host Native (Unconstrained)** | **86,946.9** | **1.14** | **1.02** | **4.36** | **23.8 MB** |
| **`crpc-go` (fasthttp)** | **Go 1.27.4** | **Docker 4 CPUs / 4GB RAM** | **62,784.4** | **1.60** | **1.41** | **4.45** | **16.1 MB** |
| **`crpc-go` (fasthttp)** | **Go 1.27.4** | **Docker 2 CPUs / 1GB RAM** | **63,119.2** | **1.58** | **1.39** | **4.08** | **12.5 MB** |
| **`crpc-go` (fasthttp)** | **Go 1.27.4** | **Docker 1 CPU / 256MB RAM** | **62,677.2** | **1.59** | **1.33** | **9.10** | **12.6 MB** |
| **`crpc-node` (`bun:serve`)** | **Bun v1.3.1** | **Host Native** | **8,741.3** | **11.40** | **11.17** | **14.92** | **94.2 MB** |
| **`crpc-node` (`bun:elysia`)** | **Bun v1.3.1** | **Host Native** | **8,703.6** | **11.45** | **11.37** | **14.30** | **98.6 MB** |
| **`crpc-node` (`bun:hono`)** | **Bun v1.3.1** | **Host Native** | **8,609.4** | **11.58** | **11.40** | **14.23** | **96.4 MB** |
| **`crpc-node` (`node:fastify`)** | **Node.js v24.2** | **Host Native** | **6,428.7** | **15.51** | **15.15** | **18.65** | **142.1 MB** |
| **`crpc-node` (`node:http`)** | **Node.js v24.2** | **Host Native** | **6,450.0** | **15.46** | **15.10** | **19.66** | **148.8 MB** |
| **`crpc-node` (`node:ultimate-express`)** | **Node.js v24.2** | **Host Native (uWS)** | **6,295.1** | **15.84** | **15.49** | **19.62** | **138.4 MB** |
| **`crpc-node` (`node:express`)** | **Node.js v24.2** | **Host Native** | **6,297.1** | **15.84** | **15.54** | **18.88** | **153.4 MB** |

### 2. Real-World Database Operations (Live PostgreSQL 16)

| Framework / Engine | Environment | DB Read (`items.list` 20 items) | Read Avg Latency | DB Write (`items.create` INSERT) | Write Avg Latency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`crpc-go` (Host Native)** | **Host Unconstrained** | **14,327.5 req/s** | **3.44 ms** | **45,883.8 req/s** | **1.08 ms** |
| **`crpc-go` (Docker 4C / 4GB)** | **Docker 4 CPUs / 4GB** | **10,204.3 req/s** | **4.84 ms** | **30,244.3 req/s** | **1.63 ms** |
| **`crpc-go` (Docker 2C / 1GB)** | **Docker 2 CPUs / 1GB** | **10,231.3 req/s** | **4.83 ms** | **33,451.1 req/s** | **1.46 ms** |
| **`crpc-go` (Docker 1C / 256MB)** | **Docker 1 CPU / 256MB** | **9,263.6 req/s** | **5.35 ms** | **30,076.0 req/s** | **1.63 ms** |
| **`crpc-node` (`bun:serve`)** | **Host Native** | **4,517.6 req/s** | **11.02 ms** | **7,882.0 req/s** | **6.28 ms** |
| **`crpc-node` (`bun:elysia`)** | **Host Native** | **4,465.4 req/s** | **11.15 ms** | **7,966.3 req/s** | **6.21 ms** |
| **`crpc-node` (`bun:hono`)** | **Host Native** | **4,342.7 req/s** | **11.47 ms** | **7,687.9 req/s** | **6.44 ms** |
| **`crpc-node` (`node:fastify`)** | **Host Native** | **3,935.4 req/s** | **12.65 ms** | **5,853.9 req/s** | **8.46 ms** |
| **`crpc-node` (`node:http`)** | **Host Native** | **3,894.1 req/s** | **12.79 ms** | **5,945.4 req/s** | **8.33 ms** |
| **`crpc-node` (`node:ultimate-express`)** | **Host Native (uWS)** | **3,812.9 req/s** | **13.06 ms** | **5,829.9 req/s** | **8.50 ms** |
| **`crpc-node` (`node:express`)** | **Host Native** | **3,846.3 req/s** | **12.95 ms** | **5,857.4 req/s** | **8.45 ms** |

### 3. Real Multipart File Uploads (Disk Storage & DB Persistence)

Tested with real production files: `Screenshot 2026-11-11 at 22.26.21.png` (191 KB) & `RideRough.pdf` (29 KB):

| Framework / Engine | PNG Image Upload (191 KB) | PNG Avg Latency | PDF Document Upload (29 KB) | PDF Avg Latency |
| :--- | :--- | :--- | :--- | :--- |
| **`crpc-go` (Host Native)** | **2,654.8 uploads/s** | **3.70 ms** | **3,103.6 uploads/s** | **3.32 ms** |
| **`crpc-go` (Docker 4C / 4GB)** | **1,878.5 uploads/s** | **5.28 ms** | **2,547.0 uploads/s** | **3.84 ms** |
| **`crpc-go` (Docker 2C / 1GB)** | **1,951.9 uploads/s** | **5.09 ms** | **2,804.1 uploads/s** | **3.49 ms** |
| **`crpc-go` (Docker 1C / 256MB)** | **1,891.4 uploads/s** | **5.66 ms** | **1,957.3 uploads/s** | **9.22 ms** |
| **`crpc-node` (`node:fastify`)** | **7,214.2 uploads/s** | **1.32 ms** | **14,812.4 uploads/s** | **0.63 ms** |
| **`crpc-node` (`node:ultimate-express`)** | **2,673.0 uploads/s** | **3.64 ms** | **3,537.2 uploads/s** | **2.75 ms** |
| **`crpc-node` (`bun:hono`)** | **2,059.4 uploads/s** | **4.82 ms** | **2,249.8 uploads/s** | **4.38 ms** |
| **`crpc-node` (`bun:elysia`)** | **1,901.2 uploads/s** | **5.21 ms** | **2,504.4 uploads/s** | **3.91 ms** |
| **`crpc-node` (`bun:serve`)** | **1,828.9 uploads/s** | **5.54 ms** | **2,448.9 uploads/s** | **4.00 ms** |
| **`crpc-node` (`node:http`)** | **1,009.1 uploads/s** | **10.02 ms** | **1,540.9 uploads/s** | **6.54 ms** |
| **`crpc-node` (`node:express`)** | **1,087.4 uploads/s** | **9.13 ms** | **1,318.3 uploads/s** | **7.55 ms** |

### 4. Attack Survival & Adversarial Fuzzing Numbers

| Adversarial Attack Scenario | Injected Load / Payload | Total Requests | HTTP 200 (Allowed) | HTTP 429 (Blocked) | HTTP 413 (Too Large) | HTTP 400/401 (Rejected) | HTTP 5xx (Crashes) | Rejection Latency (p99) | Survival Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Rate Limit Burst Flood** | 2,000 requests in <0.04s | 2,000 | **100** | **1,900** | 0 | 0 | **0** | **7.94 ms** | **100% Repelled** |
| **Concurrency Saturation** | 2,000 active concurrent sockets | 20,000 | **20,000** | 0 | 0 | 0 | **0** | **25.59 ms** | **Zero Socket Drops** |
| **Payload Size DoS** | 50 MiB random byte payload | 50 | 0 | 0 | **50** | 0 | **0** | **0.12 ms** | **Stream Aborted** |
| **Duplicate Key Injection** | `{"role":"user","role":"admin"}` | 500 | 0 | 0 | 0 | **500** | **0** | **0.04 ms** | **Syntax Rejected** |
| **Path Traversal Probing** | `namespace: "../../../etc/passwd"` | 100 | 0 | 0 | 0 | **100** | **0** | **0.02 ms** | **Routing Shielded** |
| **Unauthenticated Mutation** | `items.create` without Bearer | 1,000 | 0 | 0 | 0 | **1,000** | **0** | **0.06 ms** | **Pipeline Halted** |

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
