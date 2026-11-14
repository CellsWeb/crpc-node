---
layout: default
title: CLI & AI Batch Scaffolding
nav_order: 10
---

# Universal CLI & AI Batch Scaffolding

CellsWeb RPC provides the **`crpc`** command-line interface directly bundled inside `@cellsweb/rpc-core`. Projects require zero external script dependencies (`scripts/` folder completely eliminated).

---

## 🛠️ CLI Commands

| Command | Shortcut | Description |
| :--- | :--- | :--- |
| `crpc dev` | `pnpm dev` | Starts development server with hot-reloading |
| `crpc build` | `pnpm build` | Compiles TypeScript with production ESM relative path resolution (`tsc-alias -f`) |
| `crpc start` | `pnpm start` | Runs compiled production server (`node dist/server.js`) |
| `crpc test` | `pnpm test` | Executes in-process Vitest integration test suite |
| `crpc test:audit` | `pnpm test:audit`| Generates client-facing HTML/JSON security audit verification reports |
| `crpc create:function` | `pnpm create:function` | Scaffolds a new RPC function, contracts, and test |
| `crpc create:middleware` | `pnpm create:middleware` | Scaffolds a new reusable middleware and test |

---

## 🤖 Non-Interactive & AI Batch Scaffolding

AI coding agents and automated build systems can scaffold single functions or dozens of functions without TTY prompt blocking.

### 1. CLI Flags

```bash
pnpm crpc create:function --ns user --name updatePhone --middlewares auth,rateLimit
```

For multipart file upload endpoints:

```bash
pnpm crpc create:function --ns user --name uploadBanner --multipart --middlewares auth
```

### 2. JSON Batch String

Scaffold multiple functions in a single automated command:

```bash
pnpm crpc create:function --batch '[
  {"namespace": "billing", "name": "createInvoice", "middlewares": ["auth"]},
  {"namespace": "billing", "name": "refundInvoice", "middlewares": ["auth", "rateLimit"]},
  {"namespace": "billing", "name": "uploadReceipt", "multipart": true}
]'
```

### 3. File-Based Batch Scaffolding

Generate entire API schemas from an architect's specification file:

```bash
pnpm crpc create:function --file ./api-spec.json
```

---

## 💻 Programmatic Scaffolding API

You can call the scaffolders directly in Node.js build scripts:

```typescript
import { scaffoldFunction, scaffoldMiddleware } from "@cellsweb/rpc-core";

await scaffoldFunction(process.cwd(), {
  namespace: "user",
  name: "changePassword",
  multipart: false,
  middlewares: ["auth"],
});

await scaffoldMiddleware(process.cwd(), {
  name: "auditLog",
  description: "Records security audit trail",
});
```
