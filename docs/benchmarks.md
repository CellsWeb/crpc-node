# 📊 CellsWeb RPC (Node & Bun) Benchmark Matrix

Performance benchmarks across Node.js v24 and Bun v1.3 using `@cellsweb/rpc-core` connected to live PostgreSQL 16.

All measurements conducted in triplicate (3 consecutive runs per scenario with statistical mean averaging) using `oha` on Apple Silicon M-series hardware (macOS Darwin arm64) testing `POST /rpc`.

---

## ⚖️ CellsWeb RPC vs Node Alternatives

| Capability / Feature | CellsWeb RPC (`crpc`) | tRPC | Connect-RPC (Node) | Express/Fastify REST |
| :--- | :--- | :--- | :--- | :--- |
| **Zero-Codegen Client SDK** | **Yes** (Universal dynamic client) | Yes (TypeScript types only) | No (Requires `buf generate`) | No (Manual fetch or OpenAPI codegen) |
| **Single Unified Endpoint (`/rpc`)** | **Yes** (Unified routing & proxy config) | No (Endpoint per procedure) | No (Endpoint per method) | No (Separate URLs per route) |
| **Zero-Config Live Docs UI** | **Yes** (Server-rendered dark theme `/docs`)| No (Third-party OpenAPI) | No (Third-party tools) | No (Swagger/OpenAPI UI setup) |
| **Streaming Multipart Uploads** | **Yes** (Native streaming, Web & RN objects) | Complex (Custom FormData) | Complex (Bytes in proto) | Requires multer / busboy setup |
| **Zero-Socket In-Process Testing** | **Yes** (`createTestCaller`) | Yes (caller) | No (Network listener) | Requires supertest + port binding |
| **Dual HTTP Status Mode** | **Yes** (Uniform 200 or standard APM codes) | No (HTTP error codes) | No (gRPC status codes) | Manual error mapping |
| **Native Envelope Telemetry** | **Yes** (`onTelemetry` for Sentry / OTel) | Custom error formatting | Custom interceptors | Custom error middleware |
| **Worker Multi-Threading** | **Yes** (Declarative `worker = true;`) | No | No | Manual `worker_threads` pooling |

---

## ⚡ 1. Node & Bun Throughput & Latency (50,000 Requests, 100 Concurrency)

Tested on `POST /rpc` with payload `{"namespace":"benchmark","functionName":"ping","data":{}}`:

| Framework / Adapter | Runtime Engine | Throughput (Req/sec) | Avg Latency | p50 Latency | p99 Latency | Memory (RSS) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`bun:serve`** | **Bun v1.3.1 (Native Fetch)** | **8,741.3 req/s** | **11.40 ms** | **11.17 ms** | **14.92 ms** | **94.2 MB** |
| **`bun:elysia`** | **Bun v1.3.1 (Elysia Plugin)** | **8,703.6 req/s** | **11.45 ms** | **11.37 ms** | **14.30 ms** | **98.6 MB** |
| **`bun:hono`** | **Bun v1.3.1 (Hono on Bun)** | **8,609.4 req/s** | **11.58 ms** | **11.40 ms** | **14.23 ms** | **96.4 MB** |
| **`node:fastify`** | **Node.js v24.2 (Fastify Plugin)** | **6,428.7 req/s** | **15.51 ms** | **15.15 ms** | **18.65 ms** | **142.1 MB** |
| **`node:http`** | **Node.js v24.2 (Native HTTP)** | **6,450.0 req/s** | **15.46 ms** | **15.10 ms** | **19.66 ms** | **148.8 MB** |
| **`node:ultimate-express`** | **Node.js v24.2 (uWebSockets.js)** | **6,295.1 req/s** | **15.84 ms** | **15.49 ms** | **19.62 ms** | **138.4 MB** |
| **`node:express`** | **Node.js v24.2 (Express)** | **6,297.1 req/s** | **15.84 ms** | **15.54 ms** | **18.88 ms** | **153.4 MB** |

---

## 🗄️ 2. Real-World Database Operations (Live PostgreSQL 16)

Tested against live PostgreSQL 16 (`benchdb`) with 1,000+ indexed product records.

| Framework / Adapter | Runtime | DB Read (`items.list` 20 items) | Read Latency | DB Write (`items.create` INSERT) | Write Latency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`bun:serve`** | **Bun v1.3.1** | **4,517.6 req/s** | **11.02 ms** | **7,882.0 req/s** | **6.28 ms** |
| **`bun:elysia`** | **Bun v1.3.1** | **4,465.4 req/s** | **11.15 ms** | **7,966.3 req/s** | **6.21 ms** |
| **`bun:hono`** | **Bun v1.3.1** | **4,342.7 req/s** | **11.47 ms** | **7,687.9 req/s** | **6.44 ms** |
| **`node:fastify`** | **Node.js v24.2** | **3,935.4 req/s** | **12.65 ms** | **5,853.9 req/s** | **8.46 ms** |
| **`node:http`** | **Node.js v24.2** | **3,894.1 req/s** | **12.79 ms** | **5,945.4 req/s** | **8.33 ms** |
| **`node:ultimate-express`** | **Node.js v24.2** | **3,812.9 req/s** | **13.06 ms** | **5,829.9 req/s** | **8.50 ms** |
| **`node:express`** | **Node.js v24.2** | **3,846.3 req/s** | **12.95 ms** | **5,857.4 req/s** | **8.45 ms** |

---

## 🖼️ 3. Multipart File Upload Performance (Disk Storage & DB Persistence)

Tested with real production files: `Screenshot.png` (**191 KB**) & `RideRough.pdf` (**29 KB**). Each request streams multipart binary data, validates MIME types, saves to persistent disk storage (`./bench-uploads/`), and writes records into PostgreSQL.

| Framework / Adapter | Runtime | PNG Upload (191 KB) | PNG Latency | PDF Upload (29 KB) | PDF Latency | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`bun:hono`** | **Bun v1.3.1** | **2,059.4 uploads/s** | **4.82 ms** | **2,249.8 uploads/s** | **4.38 ms** | **HTTP 200 (Verified)** |
| **`bun:elysia`** | **Bun v1.3.1** | **1,901.2 uploads/s** | **5.21 ms** | **2,504.4 uploads/s** | **3.91 ms** | **HTTP 200 (Verified)** |
| **`bun:serve`** | **Bun v1.3.1** | **1,828.9 uploads/s** | **5.54 ms** | **2,448.9 uploads/s** | **4.00 ms** | **HTTP 200 (Verified)** |
| **`node:http`** | **Node.js v24.2** | **1,009.1 uploads/s** | **10.02 ms** | **1,540.9 uploads/s** | **6.54 ms** | **HTTP 200 (Verified)** |
| **`node:express`** | **Node.js v24.2** | **1,087.4 uploads/s** | **9.13 ms** | **1,318.3 uploads/s** | **7.55 ms** | **HTTP 200 (Verified)** |

---

## 🛡️ 4. Attack Survival & Fuzzing Suite

- **Concurrency Saturation**: 2,000 active concurrent connections sustained with 0 socket resets.
- **Rate Limit Flooding**: Flooded with 2,000 requests in <0.04s. Exactly 100 allowed (HTTP 200), 1,900 repelled (HTTP 429), 0 server crashes.
- **50MB Payload DoS**: Rejected immediately with HTTP 413 `payload_too_large` in 0.12 ms.
- **Prototype Pollution Shield**: Attacked with `{"__proto__":{"polluted":true}}`; object prototypes completely isolated (`Object.create(null)`).
- **Path Traversal Probing**: Probed with `namespace: "../../../etc/passwd"`; rejected in 0.02 ms via strict routing regex.
- **Unauthenticated Mutation**: `items.create` attempted without credentials; halted by fail-closed auth pipeline before handler dispatch.

---

## 📡 5. Observability & Native Telemetry

CellsWeb RPC provides a native `onTelemetry` lifecycle hook. Your service maintains standard transport semantics while observability systems (Sentry, Prometheus, OpenTelemetry, Datadog) extract exact RPC namespaces, procedures, error codes, and execution latencies directly:

```ts
import { CoreRPC } from "@cellsweb/rpc-core";
import * as Sentry from "@sentry/node";

export const app = new CoreRPC({
  // Native envelope telemetry hook
  onTelemetry: (event) => {
    if (event.status === "error") {
      Sentry.captureMessage(event.message || "RPC Error", {
        level: event.code === "internal_error" ? "error" : "warning",
        tags: {
          rpc_namespace: event.namespace,
          rpc_function: event.functionName,
          rpc_code: event.code,
        },
        extra: {
          requestId: event.requestId,
          durationMs: event.durationMs,
          clientIp: event.clientIp,
        },
      });
    }
  },
});
```

### Dual Status Code Mode (`useHttpStatusCodes: true`)

For Layer 7 cloud load balancers (AWS ALB, Cloudflare Workers, Nginx) that inspect only HTTP status codes and cannot parse JSON bodies, pass `useHttpStatusCodes: true` to map RPC error codes directly to standard HTTP statuses (`400`, `401`, `403`, `404`, `429`, `500`).
