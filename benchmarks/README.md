# ⚡ CellsWeb RPC Node / Bun Benchmark Harness

This directory contains reproducible benchmark servers for all supported Node.js and Bun runtime adapters:
- `bun.serve` (WinterCG Native Fetch)
- `elysia` (Elysia.js plugin)
- `node:http` (Native Node.js HTTP)
- `fastify` (Fastify plugin)
- `express` (Express middleware)
- `hono` (Hono plugin)

---

## 🚀 Running the Benchmark Servers

```bash
# 1. Native Bun:
bun servers/server-bun.ts

# 2. Elysia on Bun:
bun servers/server-elysia.ts

# 3. Node.js Native HTTP:
pnpm tsx servers/server-node.ts

# 4. Fastify:
pnpm tsx servers/server-fastify.ts

# 5. Express:
pnpm tsx servers/server-express.ts

# 6. Hono on Node:
pnpm tsx servers/server-hono.ts
```

All servers listen on port **4002** by default.

---

## 📊 Running Load & Attack Tests

```bash
# Benchmark baseline throughput (50,000 requests, 100 concurrency):
./scripts/run_bench.sh 4002

# Run security fuzzing suite:
./scripts/attack_fuzzing.sh 4002

# Run rate limit flood:
./scripts/attack_ratelimit.sh 4002
```

For full comparative benchmark results across Go, Bun, and Node.js, see [RESULTS.md](./RESULTS.md).
