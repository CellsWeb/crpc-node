---
layout: default
title: Writing Functions & Contracts
nav_order: 4
---

# Writing Functions & Contracts

Functions in CellsWeb RPC are self-contained micro-modules located in `src/functions/{namespace}/{functionName}/`.

---

## 📁 The Co-Located Triad Structure

Every function directory contains three canonical files:

```text
src/functions/user/getProfile/
├── constants.ts   # Input/Output schemas, metadata, and TypeScript types
├── middlewares.ts # Attached middleware definitions
└── run.ts         # Business logic execution handler
```

---

## 1. Defining Contracts (`constants.ts`)

`constants.ts` defines the data contracts using `@sinclair/typebox`. TypeScript types are statically inferred using `Static<typeof schema>`:

```typescript
import { Type, type Static } from "@sinclair/typebox";

export const metadata = {
  description: "Retrieves complete user profile by ID",
  tags: ["user", "profile"],
};

export const inputSchema = Type.Object({
  id: Type.String({ description: "Target user identifier" }),
});

export const outputSchema = Type.Object({
  id: Type.String(),
  email: Type.String({ format: "email" }),
  name: Type.String(),
  role: Type.String(),
  createdAt: Type.Number(),
});

export type Input = Static<typeof inputSchema>;
export type Output = Static<typeof outputSchema>;
```

---

## 2. Attaching Middlewares (`middlewares.ts`)

`middlewares.ts` binds middlewares and their runtime options:

```typescript
import { defineMiddlewares } from "@cellsweb/rpc-core";

export const middlewares = defineMiddlewares([
  {
    name: "auth",
    options: {
      roles: ["admin", "user"],
      optional: false,
    },
  },
  {
    name: "rateLimit",
    options: {
      windowSeconds: 60,
      maxRequests: 100,
    },
  },
]);
```

---

## 3. Implementing Business Logic (`run.ts`)

`run.ts` exports the default async execution handler:

```typescript
import type { Input, Output } from "./constants";
import type { Context } from "@cellsweb/rpc-core";

export default async function run(data: Input, ctx: Context): Promise<Output> {
  // 1. Read authenticated user namespaced by "auth" middleware
  const auth = ctx.auth;
  if (!auth?.user) {
    throw new Error("Authentication context missing");
  }

  // 2. Execute business logic
  return {
    id: data.id,
    email: auth.user.email,
    name: auth.user.name,
    role: auth.user.role,
    createdAt: Date.now(),
  };
}
```

> **ESM Import Tip**: Notice the use of `import type { Input, Output } from "./constants";`. In pure Node.js ESM (`"type": "module"`), using `import type` completely elides types during compilation, preventing relative extension resolution issues (`ERR_MODULE_NOT_FOUND`).

---

## 📂 Deep Nested Namespaces

Functions can be nested to arbitrary directory depths. The engine automatically creates dotted namespaces:

```text
src/functions/admin/catalog/brands/list/
```

This maps to:
- **Namespace**: `admin.catalog.brands`
- **Function**: `list`
- **Identifier**: `admin.catalog.brands.list`


### Deprecated metadata compatibility

`FunctionMetadata.isPublic?: boolean` is deprecated and ignored. It has no
function-visibility, documentation-visibility, authentication or authorization
meaning. Existing typed code may retain it until a future major release; new
generators omit it. Authentication belongs to middleware, and docs are controlled
globally. See [Interactive documentation](interactive-docs.md).
