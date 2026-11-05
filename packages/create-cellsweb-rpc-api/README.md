# `create-cellsweb-rpc-api`

[![npm version](https://img.shields.io/npm/v/create-cellsweb-rpc-api.svg)](https://www.npmjs.com/package/create-cellsweb-rpc-api)
[![license](https://img.shields.io/npm/l/create-cellsweb-rpc-api.svg)](LICENSE)

> Official CLI scaffolder for **CellsWeb RPC API** service projects.

> [!TIP]
> **CellsWeb RPC Ecosystem**:
> - ⚡ **Backend RPC Engine**: [`@cellsweb/rpc-core`](https://www.npmjs.com/package/@cellsweb/rpc-core) ($O(1)$ dispatching, TypeBox schemas, Busboy multipart)
> - 🌐 **Client SDK & React/RN Hooks**: [`@cellsweb/rpc-client`](https://www.npmjs.com/package/@cellsweb/rpc-client) (Universal fetch & automatic multipart form-data)

---

## Usage

```bash
# Interactive setup
npm create cellsweb-rpc-api@latest my-app
# or
npx create-cellsweb-rpc-api@latest my-app
# or
pnpm create cellsweb-rpc-api@latest my-app
```

### Non-Interactive & Framework Flags

You can specify your preferred base web framework directly using the `--framework` (or `-f`) flag:

```bash
# 1. Vanilla Node.js (Default — zero extra dependencies, native node:http)
npx create-cellsweb-rpc-api@latest my-app --framework node

# 2. Express (Standard — easiest for adding traditional REST routes & middleware)
npx create-cellsweb-rpc-api@latest my-app --framework express

# 3. Fastify (Modern — high performance & rich plugin ecosystem)
npx create-cellsweb-rpc-api@latest my-app --framework fastify

# 4. Ultimate-Express (Extreme Throughput — uWebSockets.js-backed Express drop-in)
npx create-cellsweb-rpc-api@latest my-app --framework ultimate-express
```

---

## Supported Base Frameworks

| Framework | Dependencies | Description |
| :--- | :--- | :--- |
| **Vanilla Node.js** *(Default)* | *None (Zero extra deps)* | Highest raw performance directly on native `node:http`. |
| **Express** | `express`, `@types/express` | Standard Express server; easily mount traditional REST routes alongside `/rpc`. |
| **Fastify** | `fastify` | Fastify server with raw stream forwarding via `reply.hijack()`. |
| **Ultimate-Express** | `ultimate-express` | Drop-in Express replacement powered by `uWebSockets.js` for extreme I/O throughput. |

---

## Features

- **Multi-Framework Flexibility**: Choose between Vanilla Node.js, Express, Fastify, or Ultimate-Express while keeping RPC function and middleware code 100% identical.
- **Unified Framework CLI (`crpc`)**: Integrated single-binary developer CLI for dev with hot-reload (`crpc dev`), production build (`crpc build`), serving (`crpc start`), and test suites (`crpc test`).
- **Pre-wired `@cellsweb/rpc-core`**: High performance $O(1)$ dispatching engine with sub-microsecond JIT schema validation.
- **Interactive & AI Batch Generators**: Built-in CLI scripts for adding new functions (`crpc create:function`) and middlewares (`crpc create:middleware`) supporting non-interactive flags, JSON batch scaffolding (`--batch '<JSON>'`), and file specs (`--file spec.json`).
- **Security & Integration Audit Testing**: Built-in in-process security audit test harness with HTML/JSON report generation (`crpc test:audit`).
- **Pre-scaffolded Common Middlewares**: Includes `auth` (JWT verification stub) and `rateLimit` (in-memory rate limiting).
- **Pluggable Extensions**: Modular application-level `env.ts` (TypeBox), `telemetry.ts` (Sentry), and `storage.ts` (Local/S3 uploads).

---

## License

MIT © Minhazur Rahman
