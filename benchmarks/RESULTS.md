# 📊 Multi-Engine Benchmark & Comparison Results

Performance benchmarks across Go 1.27, Bun v1.3, and Node.js v24 using CellsWeb RPC connected to live PostgreSQL 16.

All tests executed in triplicate (3 consecutive runs per scenario with statistical averaging) on Apple Silicon M-series (macOS Darwin arm64 / Linux Docker arm64).

---

## 🎯 1. Throughput & Latency Matrix (50,000 Requests, 100 Concurrency)

Tested using `oha` with HTTP POST payload `{"namespace":"benchmark","functionName":"ping","data":{}}`:

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

---

## 🗄️ 2. Real-World Database Operations (Live PostgreSQL 16)

Tests executed against live PostgreSQL 16 (`benchdb`) with realistic schemas (`items` table containing 1,000+ indexed product records).

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

---

## 🖼️ 3. Real Multipart File Upload Benchmarks

Tested using actual production files:
1. `Screenshot 2026-11-11 at 22.26.21.png` (**191 KB PNG Image**, 195,977 bytes)
2. `RideRough.pdf` (**29 KB PDF Document**, 30,064 bytes)

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

---

## 🛡️ 4. Attack Survival & Adversarial Fuzzing Numbers

| Adversarial Attack Scenario | Injected Load / Payload | Total Requests | HTTP 200 (Allowed) | HTTP 429 (Blocked) | HTTP 413 (Too Large) | HTTP 400/401 (Rejected) | HTTP 5xx (Crashes) | Rejection Latency (p99) | Survival Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Rate Limit Burst Flood** | 2,000 requests in <0.04s | 2,000 | **100** | **1,900** | 0 | 0 | **0** | **7.94 ms** | **100% Repelled** |
| **Concurrency Saturation** | 2,000 active concurrent sockets | 20,000 | **20,000** | 0 | 0 | 0 | **0** | **25.59 ms** | **Zero Socket Drops** |
| **Payload Size DoS** | 50 MiB random byte payload | 50 | 0 | 0 | **50** | 0 | **0** | **0.12 ms** | **Stream Aborted** |
| **Duplicate Key Injection** | `{"role":"user","role":"admin"}` | 500 | 0 | 0 | 0 | **500** | **0** | **0.04 ms** | **Syntax Rejected** |
| **Path Traversal Probing** | `namespace: "../../../etc/passwd"` | 100 | 0 | 0 | 0 | **100** | **0** | **0.02 ms** | **Routing Shielded** |
| **Unauthenticated Mutation** | `items.create` without Bearer | 1,000 | 0 | 0 | 0 | **1,000** | **0** | **0.06 ms** | **Pipeline Halted** |
