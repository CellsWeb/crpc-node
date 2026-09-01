# `@cellsweb/rpc-core`

[![npm version](https://img.shields.io/npm/v/@cellsweb/rpc-core.svg)](https://www.npmjs.com/package/@cellsweb/rpc-core)
[![license](https://img.shields.io/npm/l/@cellsweb/rpc-core.svg)](LICENSE)

> Production-grade, zero-overhead RPC runtime engine for Node.js. Features $O(1)$ function dispatching, TypeBox schema validation, Busboy streaming multipart uploads, options-based middlewares, framework-agnostic request parsing (Fastify, Express, Node.js), and auto-generated interactive documentation.

> [!TIP]
> **CellsWeb RPC Ecosystem**:
> - 🌐 **Client SDK & React/RN Hooks**: [`@cellsweb/rpc-client`](https://www.npmjs.com/package/@cellsweb/rpc-client) (Universal fetch & automatic multipart form-data)
> - 🚀 **CLI Scaffolder**: [`create-cellsweb-rpc-api`](https://www.npmjs.com/package/create-cellsweb-rpc-api) (Interactive project scaffolder & testing harness)

---

## Table of Contents

- [Key Features](#key-features)
- [Comparison & Architectural Guidance](#comparison--architectural-guidance)
  - [Framework Comparison Matrix](#framework-comparison-matrix)
  - [When to Choose CellsWeb RPC](#when-to-choose-cellsweb-rpc)
  - [When NOT to Choose CellsWeb RPC](#when-not-to-choose-cellsweb-rpc)
- [Installation](#installation)
- [Server Initialization Styles](#server-initialization-styles)
  - [Style 1: Direct Constructor](#style-1-direct-constructor)
  - [Style 2: Instance Setters](#style-2-instance-setters)
  - [Style 3: Static Chainable Builder](#style-3-static-chainable-builder)
  - [Style 4: Custom HTTP Server / Express Mount](#style-4-custom-http-server--express-mount)
- [Function Structure & Contracts](#function-structure--contracts)
  - [1. JSON RPC Function](#1-json-rpc-function)
  - [2. Multipart File Upload Function](#2-multipart-file-upload-function)
- [Custom Schema Types](#custom-schema-types)
  - [File — Single File Upload](#fileoptions--single-file-upload)
  - [Files — Multiple File Upload](#filesoptions--multiple-file-upload)
  - [FormNum — Number via FormData](#formnumoptions--number-via-formdata)
  - [FormBool — Boolean via FormData](#formbooloptions--boolean-via-formdata)
- [Middleware Architecture](#middleware-architecture)
- [Request & Response Payload Contract](#request--response-payload-contract)
- [Interactive Docs UI & Health Check](#interactive-docs-ui--health-check)
- [Scaffolding Projects (`create-cellsweb-rpc-api`)](#scaffolding-projects-create-cellsweb-rpc-api)
- [License](#license)

---

## Key Features

- **Zero-Overhead Dispatching**: Raw `node:http` execution loop with $O(1)$ in-memory function Map dispatching.
- **Strict Content-Type Contract**: Enforces accepted `contentType` (`application/json` or `multipart/form-data`) per function. Mismatches are rejected automatically.
- **Streaming File Uploads**: `busboy` streams uploaded files directly to temporary disk storage. Temp files are automatically cleaned up in `finally` blocks after request execution.
- **TypeBox Integration**: End-to-end schema validation and type inference for headers, function inputs, middleware options, and function outputs.
- **Options-Based Middlewares**: Central middlewares run declaratively per function with isolated options. Middlewares never touch function payload body data or files.
- **Interactive Documentation**: Auto-renders a dark-mode interactive API documentation UI at `/docs`.

---

## Comparison & Architectural Guidance

### Framework Comparison Matrix

| Feature | **CellsWeb RPC** | **tRPC** | **gRPC** |
|---|---|---|---|
| **Primary Platform Target** | Universal (Web, Next.js, React Native / Expo, Node) | Web Monorepos (Next.js / React) | High-Performance Microservices |
| **Transport Layer** | Standard HTTP/1.1 & HTTP/2 (Single `/rpc` endpoint) | HTTP/1.1 (JSON) | HTTP/2 (Protobuf Streams) |
| **Route Dispatching** | **$O(1)$ Hash Map Lookup** (`namespace.functionName`) | Nested Router Tree Matcher | Protobuf Service / Method Dispatch |
| **File Uploads** | **Native Built-in** (`File`, `Files`, Auto JS Object $\rightarrow$ `FormData` for RN/Web) | Requires custom `FormData` handlers / `superjson` | Custom stream chunking |
| **FormData Coercion** | **Built-in Schema Primitives** (`FormNum`, `FormBool`) | Manual Zod/TypeBox coercions | N/A (Protobuf binary) |
| **Interactive Docs UI** | **Built-in Zero-Config `/docs` Engine** (Dark theme, 2-column split view) | Requires 3rd-party (`trpc-openapi` + Swagger) | Requires 3rd-party (gRPC UI / Postman) |
| **Mobile / Expo Support** | **First-class** (Handles RN `{ uri, name, type }` natively) | Complex / Needs community workarounds | Requires Envoy gRPC-Web proxy |
| **Tooling & Setup** | Interactive CLI Scaffolder (`create-cellsweb-rpc-api`) | Manual setup / Community templates | `protoc` compiler + code generator |

---

### When to Choose CellsWeb RPC

- ✅ **Cross-Platform Applications (Web + Mobile)**: You are building a full-stack application spanning Web (React, Next.js) and Mobile (React Native / Expo) and need zero-hassle native file uploads and React hooks.
- ✅ **High-Performance $O(1)$ Function Routing**: You want ultra-fast, predictable request dispatching without generic TypeScript router tree compilation bottlenecks or regex path matching overhead.
- ✅ **Form-Heavy & Upload-Rich APIs**: You deal frequently with file uploads and form inputs, leveraging `FormNum`, `FormBool`, `File`, and `Files` schema primitives that resolve FormData string coercions automatically.
- ✅ **Zero-Config Developer Documentation**: You want instant, interactive `/docs` UI for your API without configuring third-party Swagger or OpenAPI tools.
- ✅ **Modular Directory Architecture**: You prefer clean, isolated directory structures (`src/functions/{namespace}/{functionName}/`) with automatic function and middleware discovery.

---

### When NOT to Choose CellsWeb RPC

- ❌ **Non-TypeScript / Polyglot Backend Ecosystems**: If your backend microservices are written in Rust, Go, or Java and communicate inter-service, **gRPC** with Protocol Buffers is a better fit.
- ❌ **Client-Defined GraphQL Queries**: If your client apps require dynamic field masking and client-constructed graph queries over a single unified schema graph, **GraphQL** is more suitable.
- ❌ **Purely Internal Next.js App Router Monorepos Without Mobile**: If you are exclusively building a Web-only Next.js app with zero mobile apps or external clients and want tRPC's server-side procedure chaining, **tRPC** is a popular alternative.

---

## Installation

```bash
npm install @cellsweb/rpc-core
# or
pnpm add @cellsweb/rpc-core
# or
yarn add @cellsweb/rpc-core
```

---

## Server Initialization Styles

The `CoreRPC` engine provides 4 flexible setup patterns:

### Style 1: Direct Constructor

Pass configuration directly to `new CoreRPC()`:

```ts
import { CoreRPC } from "@cellsweb/rpc-core";

const app = new CoreRPC({
  functionsDir: "./src/functions",     // default: "./src/functions"
  middlewaresDir: "./src/middlewares", // default: "./src/middlewares"
  port: 4000,                          // default: process.env.API_PORT || 4000
  host: "0.0.0.0",                     // default: "0.0.0.0"
  rpcEndpoint: "/rpc",                 // default: "/rpc" (also handles /api)
  docsEndpoint: "/docs",               // default: "/docs"
  docs: true,                          // default: true
});

await app.start();
```

---

### Style 2: Instance Setters

Chain instance setter methods:

```ts
import { CoreRPC } from "@cellsweb/rpc-core";

const app = new CoreRPC({ docs: true });

app.useFunctions("./src/functions")
   .useMiddlewares("./src/middlewares")
   .setRpcEndpoint("/v1/rpc")
   .setDocsEndpoint("/v1/docs")
   .setPort(4000);

await app.listen();
```

---

### Style 3: Static Chainable Builder

Use `CoreRPC.configure()` for fluent configuration:

```ts
import { CoreRPC } from "@cellsweb/rpc-core";

await CoreRPC.configure()
  .setPort(4000)
  .useFunctions("./src/functions")
  .useMiddlewares("./src/middlewares")
  .useRpcEndpoint("/rpc")
  .useDocsEndpoint("/docs")
  .listen();
```

---

### Style 4: Mounting on Web Frameworks (Express, Fastify, Ultimate-Express)

`app.createHandler()` returns a standard Node.js `RequestListener` `(req: IncomingMessage, res: ServerResponse) => Promise<void>` that seamlessly mounts into any Node-compatible web framework.

#### 1. Express & Ultimate-Express

`ultimate-express` is an ultra-fast, drop-in replacement for Express built on `uWebSockets.js`. Both use the identical mounting pattern:

```ts
import express from "express"; // or: import express from "ultimate-express";
import { CoreRPC } from "@cellsweb/rpc-core";

const app = express();
const rpc = new CoreRPC({
  functionsDir: "./src/functions",
  middlewaresDir: "./src/middlewares",
  rpcEndpoint: "/rpc",
  docsEndpoint: "/docs",
});

const rpcHandler = await rpc.createHandler();

// ⚠️ IMPORTANT: Mount RPC handler BEFORE any global body parsers (like express.json())!
app.use(rpcHandler);

// Standard Express routes can live side-by-side:
app.get("/api/custom-route", (req, res) => {
  res.json({ message: "Hello from standard Express route!" });
});

app.listen(4000, () => {
  console.log("Server listening at http://localhost:4000");
  console.log("RPC Endpoint: http://localhost:4000/rpc");
  console.log("Interactive Docs: http://localhost:4000/docs");
});
```

#### 2. Fastify

Fastify can be integrated using the built-in plugin adapter (`createFastifyPlugin`) or via raw stream forwarding:

##### Option A: Fastify Plugin Adapter (Recommended)
```ts
import Fastify from "fastify";
import { CoreRPC } from "@cellsweb/rpc-core";

const fastify = Fastify({ logger: true });

const rpc = new CoreRPC({
  functionsDir: "./src/functions",
  middlewaresDir: "./src/middlewares",
  rpcEndpoint: "/rpc",
  docsEndpoint: "/docs",
});

// Automatically registers /rpc, /docs, and /health
await fastify.register(rpc.createFastifyPlugin());

// Standard Fastify routes can live side-by-side
fastify.get("/api/fastify-route", async () => {
  return { hello: "world" };
});

await fastify.listen({ port: 4000, host: "0.0.0.0" });
```

##### Option B: Manual Route Bridging
```ts
const rpcHandler = await rpc.createHandler();

fastify.all("/rpc", async (req, reply) => {
  if (req.raw && req.body !== undefined) {
    (req.raw as any).body = req.body;
  }
  reply.hijack();
  await rpcHandler(req.raw, reply.raw);
});
```

#### 3. Direct In-Process Dispatching (`app.execute`)

If you want to use Express/Fastify for custom routing, URL params, or sessions and only use `@cellsweb/rpc-core` for its TypeBox validation and function registry, you can invoke functions directly in-process:

```ts
app.post("/api/custom-login", async (req, res) => {
  const result = await rpc.execute("auth.login", req.body, {
    headers: req.headers,
    contextOverrides: { ip: req.ip },
  });

  res.json(result);
});
```

> [!WARNING]
> **Stream Consumption Precedence**: `@cellsweb/rpc-core` streams raw incoming requests directly into its JSON and Busboy multipart parsers. If `app.use(express.json())` or `multer` is placed **before** `app.use(rpcHandler)`, the stream will already be drained, causing RPC requests to fail with `Request body is empty`. Always mount the RPC handler first.

---

## Function Structure & Contracts

RPC functions are placed inside `functions/{namespace}/{functionName}/`:

### 1. JSON RPC Function

#### `functions/public/getUser/constants.ts`
```ts
import { Type } from "@sinclair/typebox";

export const metadata = {
  description: "Get user details by ID",
  isPublic: true,
  tags: ["users"],
};

export const contentType = "application/json" as const;

export const inputSchema = Type.Object({
  userId: Type.String({ minLength: 1, description: "Target User ID" }),
});

export const outputSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  email: Type.String(),
});
```

#### `functions/public/getUser/run.ts`
```ts
import type { Static } from "@sinclair/typebox";
import type { MiddlewareContext } from "@cellsweb/rpc-core";
import { inputSchema, outputSchema } from "./constants";

type Input = Static<typeof inputSchema>;
type Output = Static<typeof outputSchema>;

export const run = async (input: Input, context: MiddlewareContext): Promise<Output> => {
  return {
    id: input.userId,
    name: "John Doe",
    email: "john@example.com",
  };
};
```

---

### 2. Multipart File Upload Function

Use the `File()` or `Files()` TypeBox schema helpers for uploads:

#### `functions/public/uploadAvatar/constants.ts`
```ts
import { Type } from "@sinclair/typebox";
import { File } from "@cellsweb/rpc-core";

export const metadata = {
  description: "Upload profile avatar image",
  isPublic: true,
  tags: ["uploads"],
};

export const contentType = "multipart/form-data" as const;

export const inputSchema = Type.Object({
  title: Type.String({ minLength: 1 }),
  avatar: File({
    maxSizeBytes: 5_000_000, // 5MB limit
    mimeTypes: ["image/png", "image/jpeg", "image/webp"],
    description: "Avatar image attachment",
  }),
});

export const outputSchema = Type.Object({
  url: Type.String(),
  size: Type.Number(),
});
```

#### `functions/public/uploadAvatar/run.ts`
```ts
import type { Static } from "@sinclair/typebox";
import type { MiddlewareContext } from "@cellsweb/rpc-core";
import { inputSchema, outputSchema } from "./constants";

type Input = Static<typeof inputSchema>;
type Output = Static<typeof outputSchema>;

export const run = async (input: Input, _context: MiddlewareContext): Promise<Output> => {
  // Access file properties:
  console.log(input.avatar.filename, input.avatar.byteLength, input.avatar.mimeType);

  // Read file as Buffer:
  const buffer = await input.avatar.toBuffer();

  return {
    url: `/uploads/${input.avatar.filename}`,
    size: input.avatar.byteLength,
  };
};
```

---

## Custom Schema Types

`@cellsweb/rpc-core` exports four TypeBox-compatible schema helpers that extend the standard `Type.*` primitives for common RPC patterns.

---

### `File(options?)` — Single File Upload

Declares a single uploaded file field in a `multipart/form-data` function schema.

```ts
import { File } from "@cellsweb/rpc-core";

avatar: File({
  maxSizeBytes: 5_000_000,                          // optional max file size in bytes
  mimeTypes: ["image/png", "image/jpeg"],           // optional MIME type allowlist
  description: "Profile avatar",                    // optional description shown in /docs
})
```

In `run.ts`, `input.avatar` is an `UploadedFile` instance:
```ts
input.avatar.filename     // original filename
input.avatar.mimeType     // detected MIME type
input.avatar.byteLength   // file size in bytes
await input.avatar.toBuffer()  // read as Buffer
```

---

### `Files(options?)` — Multiple File Upload

Declares an array of uploaded files. Accepts the same options as `File()` plus `maxCount`:

```ts
import { Files } from "@cellsweb/rpc-core";

images: Files({
  maxCount: 10,                                     // optional max number of files
  maxSizeBytes: 2_000_000,
  mimeTypes: ["image/*"],
})
```

In `run.ts`, `input.images` is an `UploadedFile[]` array.

---

### `FormNum(options?)` — Number via FormData

FormData serialises all non-file values as strings. `FormNum` accepts both `"22"` (string from FormData) **and** `22` (native number from JSON), and always delivers a real JavaScript `number` to `run.ts` — no manual casting needed.

```ts
import { FormNum } from "@cellsweb/rpc-core";

price:    FormNum(),   // "99.5" → 99.5  |  99.5 → 99.5
quantity: FormNum(),   // "-3"   → -3    |  -3   → -3
```

Accepted inputs: `"22"`, `"-3.5"`, `22`, `-3.5`. Rejected inputs: `"hello"`, `""`, `true`.

In `run.ts`, TypeScript type is `number` — no casting needed:
```ts
data.price * 1.2   // ✅ works directly
```

> [!NOTE]
> Use `FormNum` instead of `Type.Number()` for multipart functions where the client sends numeric values via FormData.

---

### `FormBool(options?)` — Boolean via FormData

Accepts `"true"`/`"false"` (string from FormData) **and** `true`/`false` (native boolean from JSON), always delivering a real `boolean` to `run.ts`.

```ts
import { FormBool } from "@cellsweb/rpc-core";

isPublic:  FormBool(),   // "true"  → true  |  true  → true
isDeleted: FormBool(),   // "false" → false |  false → false
```

In `run.ts`, TypeScript type is `boolean`:
```ts
if (data.isPublic) { ... }   // ✅ works directly
```

> [!NOTE]
> Use `FormBool` instead of `Type.Boolean()` for multipart functions where the client sends boolean values via FormData.

---

### Combined multipart example

```ts
import { Type } from "@sinclair/typebox";
import { File, Files, FormNum, FormBool } from "@cellsweb/rpc-core";

export const inputSchema = Type.Object({
  title:     Type.String({ minLength: 1 }),
  price:     FormNum(),
  inStock:   FormBool(),
  thumbnail: File({ maxSizeBytes: 5_000_000, mimeTypes: ["image/*"] }),
  gallery:   Files({ maxCount: 5, mimeTypes: ["image/*"] }),
});
```

```ts
// run.ts — all types are exactly what you'd expect
data.title       // string
data.price       // number  ✅ (even if sent as "99.5" via FormData)
data.inStock     // boolean ✅ (even if sent as "true" via FormData)
data.thumbnail   // UploadedFile
data.gallery     // UploadedFile[]
```

---


Central middlewares reside in `src/middlewares/{middlewareName}/`:

#### `src/middlewares/tenantGuard/run.ts`
```ts
import type { MiddlewareFn } from "@cellsweb/rpc-core";
import type { Static } from "@sinclair/typebox";
import { optionsSchema } from "./constants";

type Options = Static<typeof optionsSchema>;

export const run: MiddlewareFn<Options, { tenantId: string }> = async (
  { headers, options, function: fn },
  context,
) => {
  const tenantId = (headers["x-tenant-id"] as string) || undefined;
  if (!tenantId && !options.allowGlobal) {
    throw new Error("Missing x-tenant-id header");
  }

  // Augment and return context:
  return {
    ...context,
    tenantId: tenantId || "global",
  };
};
```

Functions declare middlewares in `functions/{ns}/{fn}/middlewares.ts`:
```ts
import { defineMiddlewares } from "@cellsweb/rpc-core";

export const middlewares = defineMiddlewares([
  { name: "tenantGuard", options: { allowGlobal: false } },
  { name: "rateLimit", options: { windowSeconds: 60, maxRequests: 100 } },
]);
```

---

## Request & Response Payload Contract

### Request (`POST /rpc` or `POST /api`)
```json
{
  "namespace": "public",
  "functionName": "getUser",
  "data": {
    "userId": "usr_123"
  }
}
```

### Success Response (`HTTP 200`)
```json
{
  "status": "ok",
  "data": {
    "id": "usr_123",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "meta": {
    "requestId": "clx123abc456",
    "durationMs": 1.42
  }
}
```

### Error Response (`HTTP 200`)
```json
{
  "status": "error",
  "code": "validation_error",
  "message": "userId: Expected string length greater or equal to 1",
  "meta": {
    "requestId": "clx123abc456",
    "durationMs": 0.85
  }
}
```

---

## Interactive Docs UI & Health Check

- **Interactive Docs UI**: Visit `http://localhost:4000/docs` in your browser.
- **Health Check**: `GET http://localhost:4000/health` returns `{ "status": "ok", "timestamp": "..." }`.

---

## Scaffolding Projects (`create-cellsweb-rpc-api`)

To scaffold a complete project pre-configured with `@cellsweb/rpc-core` and interactive CLI generators:

```bash
# Using npm
npm create cellsweb-rpc-api@latest my-app

# Using npx
npx create-cellsweb-rpc-api@latest my-app

# Using pnpm
pnpm create cellsweb-rpc-api@latest my-app
```

---

## License

MIT © Minhazur Rahman
