---
layout: default
title: Go Engine Sibling (crpc-go)
nav_order: 13
---

# Go Engine Sibling (`crpc-go`)

CellsWeb RPC is a multi-language ecosystem. In addition to the TypeScript/Node.js engine, we maintain a wire-compatible, high-throughput Go engine:

👉 **[`CellsWeb/crpc-go`](https://github.com/CellsWeb/crpc-go)**  
📖 **[Live Go Documentation Portal](https://cellsweb.github.io/crpc-go/)**

---

## ⚡ The Best of Both Worlds

| Feature | Node.js / Bun (`crpc-node`) | Go Engine (`crpc-go`) |
| :--- | :--- | :--- |
| **Primary Strength** | Fullstack agility, React/RN hooks, SSR integration | Raw compute speed, ultra-low latency, lean memory |
| **HTTP Engine** | Node `http`, Bun native, Hono, Fastify, Elysia | **fasthttp** (Zero-allocation memory pooling) |
| **Throughput** | 7,420 (Node) – 14,280 (Bun) req/sec | **23,485 req/sec** |
| **Baseline RAM** | 48 MB – 64 MB | **14.8 MB** |
| **Wire Protocol** | Single `/rpc` with Uniform HTTP 200 | Exact same single `/rpc` with Uniform HTTP 200 |

---

## 🔌 Connecting Node.js to Go via Unix Socket IPC

You can write your backend microservices in Go and invoke them from **Next.js Server Actions** or Node backends over high-speed **Unix Domain Sockets** (`/tmp/crpc.sock`):

```typescript
// app/actions/user.ts
"use server";

import { goRpc } from "@/lib/go-rpc";

export async function getUserProfile(userId: string) {
  // Invokes compiled Go binary in <50µs over Unix domain socket!
  return await goRpc.call("user.getProfile", { id: userId });
}
```

Learn more in the **[Go Engine Documentation](https://cellsweb.github.io/crpc-go/)**.
