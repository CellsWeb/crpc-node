---
layout: default
title: Middlewares & Context Pipeline
nav_order: 5
---

# Middlewares & Context Pipeline

Middlewares intercept RPC requests before function business handlers run. They handle token authentication, role validation, rate limiting, telemetry, and dependency injection.

---

## 🔑 Crucial Architectural Rule: Context Namespacing

Every middleware that produces context data **MUST namespace its output on `ctx` under its own registered middleware name**:

```typescript
// Inside auth middleware run.ts:
ctx.auth = {
  user: authenticatedUser,
};
```

Inside any downstream function:

```typescript
export default async function run(data: Input, ctx: Context): Promise<Output> {
  const user = ctx.auth.user; // 🔒 Cleanly namespaced under 'auth'
}
```

### Why Namespacing Matters
When invoking functions from external callers or SSR frameworks with pre-authenticated sessions:

```typescript
// Next.js Server Action or Client passing session
await client.request({
  namespace: "user",
  functionName: "getProfile",
  data: { id: "123" },
  skipMiddlewares: true,
  context: {
    auth: {
      user: session.user,
    },
  },
});
```

Because `ctx` is strictly namespaced under `ctx.auth`, your business handler runs identically whether authentication was performed by the Go/Node HTTP middleware or injected directly by a session provider!

---

## 📁 Middleware Directory Structure

Middlewares live in `src/middlewares/{middlewareName}/`:

```text
src/middlewares/auth/
├── constants.ts # Metadata, optionsSchema, and headersSchema
└── run.ts       # Middleware execution function
```

---

## 1. Defining Middleware Contracts (`constants.ts`)

```typescript
import { Type, type Static } from "@sinclair/typebox";

export const metadata = {
  name: "auth",
  description: "Validates Bearer JWT tokens and injects authenticated user into context",
};

export const optionsSchema = Type.Object({
  roles: Type.Optional(Type.Array(Type.String())),
  optional: Type.Optional(Type.Boolean()),
});

export const headersSchema = Type.Object({
  authorization: Type.Optional(Type.String({ description: "Bearer JWT token" })),
});

export type Options = Static<typeof optionsSchema>;
export type Headers = Static<typeof headersSchema>;
```

---

## 2. Implementing Middleware Logic (`run.ts`)

```typescript
import type { Context, MiddlewareFn } from "@cellsweb/rpc-core";
import type { Options, Headers } from "./constants";

const authMiddleware: MiddlewareFn<Options, Headers> = async (ctx, headers, options) => {
  const authHeader = headers.authorization;

  if (!authHeader) {
    if (options.optional) return;
    throw {
      code: "unauthorized",
      message: "Missing Authorization header",
    };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (token !== "secret_token_123") {
    throw {
      code: "unauthorized",
      message: "Invalid or expired token",
    };
  }

  // 🔒 Inject into context namespaced under "auth"
  ctx.auth = {
    user: {
      id: "usr_42",
      email: "alex@cellsweb.com",
      role: "admin",
    },
  };
};

export default authMiddleware;
```

---

## 🛡️ Fail-Closed Security Pipeline

CellsWeb RPC implements strict **fail-closed** security:
- If a function references a middleware that is missing or not registered in `src/middlewares/`, the pipeline **fails closed immediately** with `internal_error`.
- The engine will **never** silently bypass missing middlewares to execute an unauthenticated or unprotected handler.
