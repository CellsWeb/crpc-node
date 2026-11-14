# 📊 Multi-Engine Benchmarks & Comparison Matrix

This document provides a comprehensive side-by-side performance comparison, Docker resource matrix, and architectural analysis between **CellsWeb RPC (`crpc`)**, Connect-RPC, tRPC, and Twirp across Go, Bun, and Node.js.

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

## ⚡ Multi-Engine Throughput Benchmark

Tested on Apple Silicon M-series (macOS Darwin arm64) using `oha` with 50,000 requests at 100 concurrent workers on `POST /rpc`:

| Engine / Runtime | Environment | Throughput (Req/sec) | Avg Latency | p99 Latency | RSS Memory |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`crpc-go` (fasthttp + JSON v2)** | **Go 1.27 (Host Native)** | **89,719 req/s** | **1.08 ms** | **2.67 ms** | **36.8 MiB** |
| **`crpc-go` (fasthttp + JSON v2)** | **Docker 4 CPUs, 4GB RAM** | **67,171 req/s** | **1.48 ms** | **2.94 ms** | **12.6 MiB** |
| **`crpc-go` (fasthttp + JSON v2)** | **Docker 2 CPUs, 1GB RAM** | **66,447 req/s** | **1.48 ms** | **3.01 ms** | **11.8 MiB** |
| **`crpc-go` (fasthttp + JSON v2)** | **Docker 1 CPU, 256MB RAM** | **53,592 req/s** | **1.83 ms** | **3.89 ms** | **12.4 MiB** |
| **`crpc-node` (`bun.serve`)** | **Bun v1.3.1 (Native Fetch)** | **7,236 req/s** | **13.75 ms** | **27.60 ms** | **94.2 MiB** |
| **`crpc-node` (`elysiaPlugin`)** | **Bun v1.3.1 (Elysia.js)** | **6,840 req/s** | **14.54 ms** | **28.40 ms** | **98.6 MiB** |
| **`crpc-node` (`fastifyPlugin`)** | **Node.js v24.2 (Fastify)** | **6,199 req/s** | **16.04 ms** | **31.10 ms** | **142.1 MiB** |
| **`crpc-node` (`node:http`)** | **Node.js v24.2 (Native HTTP)** | **6,187 req/s** | **16.06 ms** | **30.90 ms** | **148.8 MiB** |
| **`crpc-node` (`express`)** | **Node.js v24.2 (Express)** | **6,016 req/s** | **16.53 ms** | **32.80 ms** | **153.4 MiB** |
| **`crpc-node` (`honoPlugin`)** | **Node.js v24.2 (Hono)** | **5,622 req/s** | **17.69 ms** | **33.70 ms** | **158.2 MiB** |

---

## 🚦 Dual Status Code Modes (`useHttpStatusCodes`)

By default, CellsWeb RPC returns HTTP 200 for all business and validation errors with structured error envelopes. For production environments connected to Datadog, Cloudflare, Prometheus, or reverse proxies requiring HTTP error codes, pass `useHttpStatusCodes: true`:

```ts
import { CoreRPC } from "@cellsweb/rpc-core";

export const app = new CoreRPC({
  useHttpStatusCodes: true, // Emits standard 400, 401, 403, 404, 429, 500
});
```
