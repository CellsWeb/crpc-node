---
layout: default
title: Framework Adapters (Hono, Elysia, Fastify, Bun)
nav_order: 7
---

# Universal Framework Adapters

CellsWeb RPC Node is framework-agnostic. It can run as a standalone HTTP server or mount as a first-class plugin inside **Hono**, **Elysia.js**, **Fastify**, **Express**, and **Native Bun**.

---

## 1. Hono Adapter (`app.honoPlugin`)

Runs on Node.js, Bun, Cloudflare Workers, Fastly Compute, and Deno:

```typescript
import { Hono } from "hono";
import { CoreRPC } from "@cellsweb/rpc-core";

const app = new Hono();
const rpc = new CoreRPC({
  functionsDir: "./src/functions",
  middlewaresDir: "./src/middlewares",
  rpcEndpoint: "/rpc",
  docsEndpoint: "/docs",
});

await rpc.init();

// Mount RPC plugin on Hono
app.route("/", rpc.honoPlugin());

export default app;
```

---

## 2. Elysia.js Adapter (`app.elysiaPlugin`)

Engineered for ultra-fast Bun runtimes:

```typescript
import { Elysia } from "elysia";
import { CoreRPC } from "@cellsweb/rpc-core";

const rpc = new CoreRPC({
  functionsDir: "./src/functions",
  middlewaresDir: "./src/middlewares",
  rpcEndpoint: "/rpc",
});

await rpc.init();

const app = new Elysia()
  .use(rpc.elysiaPlugin())
  .listen(4000);

console.log(`🦊 Elysia + CellsWeb RPC running at ${app.server?.hostname}:${app.server?.port}`);
```

---

## 3. Fastify Adapter (`app.fastifyPlugin`)

Pre-parsed request bodies (Fastify `req.body`) are automatically supported without stream drain errors:

```typescript
import Fastify from "fastify";
import { CoreRPC } from "@cellsweb/rpc-core";

const fastify = Fastify({ logger: true });

const rpc = new CoreRPC({
  functionsDir: "./src/functions",
  middlewaresDir: "./src/middlewares",
  rpcEndpoint: "/rpc",
});

await rpc.init();

// Register Fastify plugin
await fastify.register(rpc.fastifyPlugin());

await fastify.listen({ port: 4000, host: "0.0.0.0" });
```

---

## 4. Bun Native HTTP Server (`app.serveBun`)

```typescript
import { CoreRPC } from "@cellsweb/rpc-core";

const rpc = new CoreRPC({
  functionsDir: "./src/functions",
  middlewaresDir: "./src/middlewares",
  port: 4000,
});

await rpc.init();

// Starts native Bun.serve()
rpc.serveBun();
```

---

## 5. Web Standards Fetch API (`app.fetch`)

`CoreRPC` implements the WinterCG standard `fetch(request: Request): Promise<Response>` interface:

```typescript
const response = await rpc.fetch(new Request("http://localhost:4000/rpc", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    namespace: "user",
    functionName: "getProfile",
    data: { id: "101" },
  }),
}));

const data = await response.json();
```
