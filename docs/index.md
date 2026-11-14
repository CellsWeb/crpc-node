---
layout: default
title: CellsWeb RPC Node Documentation
nav_order: 1
---

<p align="center">
  <a href="https://cellsweb.com" target="_blank" rel="noopener noreferrer">
    <img src="https://cellsweb.com/logo.svg" alt="CellsWeb Logo" width="340" style="background: rgba(255, 255, 255, 0.96); padding: 16px 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08); display: inline-block; max-width: 100%;" />
  </a>
</p>

<p align="center">
  <strong>High-Performance RPC API Framework for Node.js, Bun & TypeScript</strong><br>
  <a href="https://cellsweb.com">🌐 Official Website</a> •
  <a href="https://cellsweb.github.io/crpc-node/">📖 Node Engine Docs</a> •
  <a href="https://cellsweb.github.io/crpc-go/">📖 Go Engine Docs</a> •
  <a href="https://github.com/CellsWeb">🏛️ GitHub Organization</a>
</p>

# CellsWeb RPC (Node.js & Bun Engine)

> **High-performance, zero-overhead RPC API framework for Node.js, Bun, and TypeScript applications across Web, Mobile (React Native / Expo), and Microservices.**

[![npm: @cellsweb/rpc-core](https://img.shields.io/npm/v/@cellsweb/rpc-core.svg?label=@cellsweb/rpc-core)](https://www.npmjs.com/package/@cellsweb/rpc-core)
[![npm: @cellsweb/rpc-client](https://img.shields.io/npm/v/@cellsweb/rpc-client.svg?label=@cellsweb/rpc-client)](https://www.npmjs.com/package/@cellsweb/rpc-client)
[![npm: create-cellsweb-rpc-api](https://img.shields.io/npm/v/create-cellsweb-rpc-api.svg?label=create-cellsweb-rpc-api)](https://www.npmjs.com/package/create-cellsweb-rpc-api)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/CellsWeb/crpc-node/blob/main/LICENSE)

---

## 🌟 Overview

**CellsWeb RPC Node (`crpc-node`)** is an enterprise-grade RPC API framework engineered from production foundations. It completely eliminates REST and GraphQL boilerplate while maintaining strict runtime validation, complete TypeScript type inference, and deterministic client behavior.

### Why CellsWeb RPC?
- **Zero Overhead**: Strips unnecessary abstraction layers to achieve maximum request throughput.
- **$O(1)$ Function Dispatching**: Pre-indexed namespace and function hash lookup map guarantees instantaneous routing without regex or dynamic URL parsing.
- **Sub-Microsecond JIT Validation**: Powered by TypeBox's TurboFan machine-compiled `TypeCompiler.Compile()`, validating requests in **<0.8µs**.
- **Declarative Worker Thread Pool**: Heavy CPU tasks (cryptography, PDF rendering, image transformation) execute off the event loop by specifying `worker = true`.
- **Single-Endpoint Architecture**: All operations pass through `POST /rpc` with uniform `{ namespace, functionName, data }` envelopes.
- **Uniform HTTP 200 Error Protocol**: Business, validation, and authentication errors return HTTP 200 with structured error envelopes.
- **Universal Framework Adapters**: First-class plugins for **Hono**, **Elysia.js**, **Fastify**, **Express**, and **Bun Native**.
- **Universal Client SDK**: Seamless client library with automatic object $\rightarrow$ `FormData` conversion for Web, React, Next.js, and React Native / Expo.
- **Go Engine Sibling**: Wire-compatible with the high-throughput Go engine [`CellsWeb/crpc-go`](https://cellsweb.github.io/crpc-go/).

---

## 📦 Workspace Monorepo Packages

This repository contains three tightly integrated packages:

```text
crpc-node/
├── packages/
│   ├── rpc-core/                 # @cellsweb/rpc-core (Server Runtime Engine)
│   ├── rpc-client/               # @cellsweb/rpc-client (Client SDK & React/RN Hooks)
│   └── create-cellsweb-rpc-api/  # create-cellsweb-rpc-api (CLI & Scaffolder)
```

1. **[`@cellsweb/rpc-core`](https://www.npmjs.com/package/@cellsweb/rpc-core)**: Core server engine (`CoreRPC`), TypeBox JIT schema compiler, streaming Busboy multipart parser, worker thread pool, and `/docs` portal.
2. **[`@cellsweb/rpc-client`](https://www.npmjs.com/package/@cellsweb/rpc-client)**: Universal client SDK for Web, React, Next.js, React Native, and Expo with automatic multipart conversion and React hooks (`useRpcQuery`, `useRpcMutation`).
3. **[`create-cellsweb-rpc-api`](https://www.npmjs.com/package/create-cellsweb-rpc-api)**: Scaffolder CLI (`npx create-cellsweb-rpc-api@latest my-app`) supporting Node.js, Express, Fastify, Hono, Elysia, and Bun.

---

## 📚 Documentation Table of Contents

- **Overview**
  - [Introduction](./index.md)
  - [Getting Started](./getting-started.md)
  - [Architecture & Protocol](./architecture.md)
- **Core Guides**
  - [Writing Functions & Contracts](./functions.md)
  - [Middlewares & Context Pipeline](./middlewares.md)
  - [Multi-Threading via Worker Threads](./workers.md)
  - [Framework Adapters (Hono, Elysia, Fastify, Bun)](./adapters.md)
- **Client SDK & React**
  - [Universal Client & React Hooks](./client.md)
  - [Multipart & File Uploads (Web & React Native)](./uploads.md)
- **Tooling & Operations**
  - [CLI & AI Batch Scaffolding](./cli.md)
  - [In-Process Testing & Security Audits](./testing.md)
  - [API Reference](./api-reference.md)
  - [Go Engine Sibling (`crpc-go`)](./crpc-go.md)
