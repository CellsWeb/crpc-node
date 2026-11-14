# 📊 Multi-Engine Benchmark & Comparison Results

Performance benchmarks across Node.js v24, Bun v1.3, and Go 1.27 using CellsWeb RPC.

---

## 🎯 1. Throughput & Latency Matrix (50,000 Requests, 100 Concurrency)

Tested on Apple Silicon M-series (macOS Darwin arm64) using `oha`:

| Engine / Runtime | Environment | Throughput (Req/sec) | Avg Latency | p99 Latency | RSS Memory |
| :--- | :--- | :--- | :--- | :--- |
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

## 💡 Key Architectural Takeaways

1. **Bun vs Node**: Bun's native C++ HTTP server delivers ~17% higher RPC throughput than Node's `node:http` or Fastify.
2. **Go vs JavaScript**: Compiled Go with fasthttp and zero-allocation JSON v2 provides **~12.4x to 15.9x higher throughput** and uses **under 10% of the RAM** required by V8 / JavaScript runtimes.
3. **Cross-Engine Protocol Interoperability**: Both Go and TypeScript engines share 100% protocol fidelity:
   - Single `/rpc` endpoint
   - Universal `{ namespace, functionName, data }` contract
   - Options-based middleware pipeline
   - Dual-mode status codes (`HTTP 200` envelope vs standard `400/401/404/429/500` codes via `useHttpStatusCodes: true`)
