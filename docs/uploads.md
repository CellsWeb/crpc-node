---
layout: default
title: Multipart & File Uploads (Web & React Native)
nav_order: 9
---

# Multipart & File Uploads (Web & Mobile)

Handling file uploads in modern applications is notoriously messy. CellsWeb RPC provides a unified, zero-boilerplate solution that works seamlessly across **Web (`File` / `Blob`)** and **React Native / Expo (`{ uri, name, type }`)**.

---

## ⚡ Automatic Object $\rightarrow$ `FormData` Conversion

Developers never have to construct manual `FormData` instances. Simply pass `multipart: true`:

```typescript
// Web React Component:
const file = event.target.files[0];

await rpc.request({
  namespace: "user",
  functionName: "uploadAvatar",
  multipart: true,
  data: {
    userId: "usr_101",
    avatar: file, // Standard Web File or Blob
  },
});
```

### React Native & Expo File Uploads

In React Native, pass the native asset object with `uri`, `name`, and `type`:

```typescript
import * as ImagePicker from "expo-image-picker";

const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
});

if (!result.canceled) {
  const asset = result.assets[0];

  await rpc.request({
    namespace: "user",
    functionName: "uploadAvatar",
    multipart: true,
    data: {
      userId: "usr_101",
      avatar: {
        uri: asset.uri,
        name: asset.fileName || "photo.jpg",
        type: asset.mimeType || "image/jpeg",
      },
    },
  });
}
```

---

## 🛡️ Backend Busboy Streaming & DoS Shield

On the backend, `@cellsweb/rpc-core` streams multipart incoming data directly through `busboy`:

1. **Zero Memory Bloat**: Files stream to temporary disk storage in an isolated `0o700` permission directory.
2. **Stream Bounds Enforcement**: Enforces strict limits (`parts: 150`, `files: 20`, `fields: 100`, `fieldSize: 1MB`). Exceeding limits triggers immediate stream destruction (`abortAll()`).
3. **Prototype Pollution Shield**: Rejects reserved property keys (`__proto__`, `constructor`, `prototype`).
4. **Collision Containment**: Multipart metadata fields (`_data_namespace`, `_data_functionName`) are safely quarantined to eliminate routing collisions.

---

## 💻 Backend Function Implementation

```typescript
// src/functions/user/uploadAvatar/constants.ts
import { Type, type Static } from "@sinclair/typebox";

export const inputSchema = Type.Object({
  userId: Type.String(),
  avatar: Type.Any({ format: "binary", description: "Uploaded avatar image" }),
});

export const outputSchema = Type.Object({
  url: Type.String(),
});

export type Input = Static<typeof inputSchema>;
export type Output = Static<typeof outputSchema>;
```

```typescript
// src/functions/user/uploadAvatar/run.ts
import type { Input, Output } from "./constants";
import type { Context, UploadedFile } from "@cellsweb/rpc-core";
import fs from "node:fs/promises";
import path from "node:path";

export default async function run(data: Input, ctx: Context): Promise<Output> {
  const avatar = data.avatar as UploadedFile;

  if (!avatar) {
    throw { code: "validation_error", message: "Avatar file required" };
  }

  // Move temporary file to persistent storage
  const destPath = path.join("./public/uploads", avatar.filename);
  await fs.rename(avatar.filepath, destPath);

  return {
    url: `/uploads/${avatar.filename}`,
  };
}
```
