# CellsWeb RPC API Service

Welcome to your production-ready **CellsWeb RPC API** service!

Powered by `@cellsweb/rpc-core` — zero framework overhead, TypeBox schema validation, $O(1)$ in-memory function dispatching, and built-in interactive CLI generators.

---

## Quick Start Commands

```bash
pnpm run dev                  # Start dev server with hot-reload (http://localhost:4000)
pnpm run typecheck            # Check TypeScript types
pnpm test                     # Run Vitest test suite
pnpm run create:function      # Interactively scaffold a new API function + test
pnpm run create:middleware    # Interactively scaffold a new central middleware + test
pnpm run build                # Compile TypeScript to dist/ for production
pnpm start                    # Run compiled server (node dist/server.js)
```

---

## Architecture Overview

```txt
src/
├── server.ts          — Entrypoint initializing CoreRPC
├── env.ts             — TypeBox environment configuration
├── telemetry.ts       — Optional Sentry error tracking hook
├── utils/
│   └── storage.ts     — Dual Local & AWS S3 file storage utility
├── middlewares/
│   ├── auth/          — Pre-scaffolded JWT auth stub with instructions
│   └── rateLimit/     — Pre-scaffolded rate limit stub with instructions
└── functions/
    └── public/
        └── hello/     — Sample JSON RPC function
```

---

## Single API Endpoint (`POST /rpc` or `POST /api`)

### JSON Request Example
```json
{
  "namespace": "public",
  "functionName": "hello",
  "data": {
    "name": "Alice"
  }
}
```

### Multipart Request Example (`Content-Type: multipart/form-data`)
Pass form-data fields:
- `namespace`: `"public"`
- `functionName`: `"uploadAvatar"`
- `title`: `"My Avatar"`
- `avatar`: `<file attachment>`

---

## Creating Functions & Middlewares

### Scaffold a New Function
```bash
pnpm run create:function
```

Generates:
```txt
src/functions/{namespace}/{functionName}/
├── constants.ts   — Metadata, accepted Content-Type, and TypeBox schemas
├── run.ts         — Business logic handler
├── middlewares.ts — Declarative middleware pipeline ({ name, options })
└── test.ts        — Vitest unit test
```

### Scaffold a New Middleware
```bash
pnpm run create:middleware
```

Generates:
```txt
src/middlewares/{middlewareName}/
├── constants.ts   — Metadata, headersSchema, and optionsSchema
├── run.ts         — Middleware logic (receives headers, options, function, context)
└── test.ts        — Vitest unit test
```

---

## Storage & File Uploads

Use `storage.upload()` inside function `run.ts`:

```ts
import { storage } from "@/utils/storage";

export const run = async (input, _context) => {
  const fileBuffer = await input.avatar.toBuffer();
  const saved = await storage.upload(fileBuffer, input.avatar.filename, "avatars");
  return { url: saved.url };
};
```

Set `UPLOAD_MODE=s3` in `.env` along with `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` to switch to S3 mode seamlessly.

---

## Interactive Documentation & Health

- **Interactive API Docs**: Visit `http://localhost:4000/docs` in your browser.
- **Health Check**: `GET http://localhost:4000/health`.
