---
layout: default
title: Getting Started
nav_order: 2
---

# Getting Started

Scaffold, develop, and run your first CellsWeb RPC Node application in seconds.

---

## 🛠️ Prerequisites

- **Node.js**: Version `18.0.0` or higher (`v20+` recommended) OR **Bun**: Version `1.0+`
- **Package Manager**: `pnpm` (recommended), `npm`, or `bun`

---

## 🚀 Scaffolding a New Project

Use the official interactive CLI scaffolder:

```bash
npx create-cellsweb-rpc-api@latest my-rpc-api
```

### Direct Framework Flags

You can bypass interactive prompts by specifying your preferred framework adapter:

```bash
# Standalone Node.js HTTP (Default)
npx create-cellsweb-rpc-api@latest my-app -f node

# Hono Adapter (WinterCG Fetch / Cloudflare Workers / Node)
npx create-cellsweb-rpc-api@latest my-app -f hono

# Elysia.js Adapter (High-performance Bun)
npx create-cellsweb-rpc-api@latest my-app -f elysia

# Fastify Adapter
npx create-cellsweb-rpc-api@latest my-app -f fastify

# Native Bun HTTP Server
bun create cellsweb-rpc-api@latest my-app -f bun
```

---

## 📁 Generated Project Structure

```text
my-rpc-api/
├── src/
│   ├── functions/               # RPC Functions grouped by namespace
│   │   └── user/
│   │       └── getProfile/
│   │           ├── constants.ts   # TypeBox Input & Output schemas
│   │           ├── middlewares.ts # Middleware bindings
│   │           └── run.ts         # Business logic handler
│   ├── middlewares/             # Reusable middleware modules
│   │   └── auth/
│   │       ├── constants.ts     # Options & Headers schemas
│   │       └── run.ts           # Middleware execution logic
│   ├── env.ts                   # Strict environment variable validation
│   └── server.ts                # Application entrypoint & HTTP server bootstrap
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 🏃 Running the Application

Navigate into your project directory and start the hot-reloading development server:

```bash
cd my-rpc-api
pnpm install
pnpm run dev
```

The server initializes:

```text
⚡ CoreRPC listening at http://localhost:4000
📡 RPC Endpoint: POST http://localhost:4000/rpc
📖 Interactive Docs: GET http://localhost:4000/docs
🩺 Health Check: GET http://localhost:4000/health
```

---

## 🧪 Testing Your First RPC Call

All RPC operations dispatch through `POST /rpc` with uniform JSON payloads:

```bash
curl -X POST http://localhost:4000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "namespace": "public",
    "functionName": "hello",
    "data": {
      "name": "Alex"
    }
  }'
```

### Success Response (HTTP 200)

```json
{
  "status": "ok",
  "data": {
    "greeting": "Hello Alex! Welcome to CellsWeb RPC."
  },
  "meta": {
    "requestId": "req_8f1d3e2a",
    "durationMs": 0.45
  }
}
```

---

## 📖 Zero-Config Interactive Docs

Open your browser and visit:

👉 **`http://localhost:4000/docs`**

The built-in dark documentation portal allows you to inspect input/output schemas in a 2-column split view, review attached middlewares, and run one-click copyable cURL commands!
