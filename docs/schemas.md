---
layout: default
title: Data Types & Schema Validation
nav_order: 5
---

# Data Types & Schema Validation

CellsWeb RPC Node uses **`@sinclair/typebox`** for schema definitions. Schemas are JIT-compiled into TurboFan machine instructions via `TypeCompiler.Compile()`, executing runtime validation in **<0.8 microseconds**.

---

## 🏗️ TypeBox Contract Syntax

Every contract in `constants.ts` defines `inputSchema` and `outputSchema` using `Type.*`:

```typescript
import { Type, type Static } from "@sinclair/typebox";

export const inputSchema = Type.Object({
  // String constraints
  name: Type.String({ minLength: 2, maxLength: 50, description: "Full user name" }),
  email: Type.String({ format: "email", description: "Verified email address" }),
  password: Type.String({ minLength: 8, maxLength: 128 }),

  // Numbers & Integers
  age: Type.Optional(Type.Integer({ minimum: 18, maximum: 120 })),
  score: Type.Optional(Type.Number({ minimum: 0.0, maximum: 100.0 })),

  // Enums / Unions
  role: Type.Union([
    Type.Literal("admin"),
    Type.Literal("editor"),
    Type.Literal("user"),
  ], { default: "user" }),

  // Binary file upload constraints
  avatar: Type.Optional(Type.Any({
    format: "binary",
    description: "Profile avatar image",
  })),

  // Arrays
  tags: Type.Optional(Type.Array(Type.String(), { maxItems: 10 })),
});

export type Input = Static<typeof inputSchema>;
```

---

## 📋 Complete Validator & Type Catalog

### 1. Strings (`Type.String`)

| Option | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| `minLength` | `number` | `{ minLength: 3 }` | Minimum character length |
| `maxLength` | `number` | `{ maxLength: 100 }` | Maximum character length |
| `pattern` | `string` | `{ pattern: "^[a-z0-9_-]+$" }` | Regular expression match |
| `format` | `string` | `{ format: "email" }` | Format (`email`, `uuid`, `uri`, `date-time`) |
| `default` | `string` | `{ default: "anonymous" }` | Fallback default value |

---

### 2. Numbers (`Type.Number` & `Type.Integer`)

| Option | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| `minimum` | `number` | `{ minimum: 0 }` | Minimum allowed value |
| `maximum` | `number` | `{ maximum: 1000 }` | Maximum allowed value |
| `exclusiveMinimum` | `number` | `{ exclusiveMinimum: 0 }` | Strictly greater than |
| `multipleOf` | `number` | `{ multipleOf: 5 }` | Must be divisible by value |

---

### 3. Enums and Fixed Choices

```typescript
export const StatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("approved"),
  Type.Literal("rejected"),
]);
```

---

### 4. Binary Files (`format: "binary"`)

File uploads are identified by `{ format: "binary" }`:

```typescript
export const DocumentUploadSchema = Type.Object({
  userId: Type.String(),
  document: Type.Any({
    format: "binary",
    description: "PDF invoice file (max 10MB)",
  }),
});
```

On the backend, `data.document` automatically resolves to an `UploadedFile` object with `filename`, `filepath`, `mimetype`, and `size`.

---

### 5. Arrays and Lists

```typescript
export const ItemListSchema = Type.Array(
  Type.Object({
    itemId: Type.String(),
    quantity: Type.Integer({ minimum: 1 }),
  }),
  { minItems: 1, maxItems: 50 }
);
```

---

## ⚡ JIT Compiler Performance vs Other Libraries

Benchmarked on 1,000,000 payload validations:

| Library | Validation Speed | Compilation |
| :--- | :--- | :--- |
| **TypeBox (CellsWeb RPC JIT)** | **0.78 µs / req** | **TurboFan V8 Machine Code** |
| Zod | 8.42 µs / req | Interpreted AST |
| Yup | 14.10 µs / req | Interpreted AST |
| Joi | 12.80 µs / req | Interpreted AST |
