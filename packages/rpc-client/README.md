# @cellsweb/rpc-client

[![npm version](https://img.shields.io/npm/v/@cellsweb/rpc-client.svg)](https://www.npmjs.com/package/@cellsweb/rpc-client)
[![license](https://img.shields.io/npm/l/@cellsweb/rpc-client.svg)](LICENSE)

Official Client SDK & React / React Native Hooks for **CellsWeb RPC API**. Supports universal `fetch`, automatic multipart `FormData` object conversion, base header/body merging, and React hooks.

> [!TIP]
> **CellsWeb RPC Ecosystem**:
> - ⚡ **Backend RPC Engine**: [`@cellsweb/rpc-core`](https://www.npmjs.com/package/@cellsweb/rpc-core) ($O(1)$ dispatching, TypeBox schemas, Busboy multipart)
> - 🚀 **CLI Scaffolder**: [`create-cellsweb-rpc-api`](https://www.npmjs.com/package/create-cellsweb-rpc-api) (Production-ready API starter template & test runner)

---

## 📦 Installation

```bash
npm install @cellsweb/rpc-client
# or
pnpm add @cellsweb/rpc-client
# or
yarn add @cellsweb/rpc-client
```

---

## ⚡ Quick Start

### 1. Direct API Request (`rawRpcRequest`)
Use `rawRpcRequest` anywhere outside of React providers — inside services, utility functions, state stores, or background scripts:

```ts
import { rawRpcRequest, RpcError } from "@cellsweb/rpc-client";

try {
  const data = await rawRpcRequest<{ user: UserProfile }>({
    baseUrl: "https://api.example.com",
    namespace: "auth",
    functionName: "profile",
    headers: { authorization: "Bearer custom_auth_token" },
  });
  console.log("User profile:", data.user);
} catch (err) {
  if (err instanceof RpcError) {
    console.error("RPC Error:", err.code, err.message, err.status);
  }
}
```

---

### 2. Standalone Client Instance (`createRpcClient`)
Create a configured client instance with default `baseUrl`, default headers, and default body payload:

```ts
import { createRpcClient } from "@cellsweb/rpc-client";

export const rpc = createRpcClient({
  baseUrl: "https://api.example.com",
  defaultHeaders: () => ({ authorization: `Bearer ${getAuthToken()}` }),
  defaultBody: { appId: "com.example.app" },
});

// Use anywhere in your app:
const result = await rpc.request<{ success: boolean }>({
  namespace: "orders",
  functionName: "create",
  data: { items: [{ id: "p1", quantity: 2 }] },
});
```

---

### 3. React & React Native Setup (`<RpcProvider>`)
Wrap your app root with `<RpcProvider>` to share configuration across all components:

```tsx
import React from "react";
import { RpcProvider } from "@cellsweb/rpc-client/react";

export function App() {
  return (
    <RpcProvider
      baseUrl="https://api.example.com"
      defaultHeaders={() => ({ authorization: `Bearer ${getAuthToken()}` })}
      defaultBody={{ appId: "com.example.app" }}
    >
      <MainNavigator />
    </RpcProvider>
  );
}
```

---

### 4. Fetching Data with `useRpcQuery`
Data fetching hook with loading states, error handling, auto-refetch, and manual trigger:

```tsx
import React from "react";
import { useRpcQuery } from "@cellsweb/rpc-client/react";

function ProductList() {
  const { data, loading, error, refetch } = useRpcQuery<{ products: Product[] }>({
    namespace: "products",
    functionName: "list",
    data: { category: "electronics" },
  });

  if (loading) return <div>Loading products…</div>;
  if (error) return <div>Error loading products!</div>;

  return (
    <div>
      <button onClick={() => refetch()}>Refresh</button>
      {data?.products.map((p) => (
        <div key={p.id}>{p.name}</div>
      ))}
    </div>
  );
}
```

---

### 5. Mutations & Automatic File Uploads with `useRpcMutation`
Mutation hook for POST requests. Supports **automatic multipart `FormData` auto-detection** for Web (`File`/`Blob`) and React Native (`{ uri, name, type }`) objects!

```tsx
import React, { useState } from "react";
import { useRpcMutation } from "@cellsweb/rpc-client/react";

function AvatarUploader() {
  const [file, setFile] = useState<File | null>(null);

  const { mutate, loading, error } = useRpcMutation({
    namespace: "public",
    functionName: "upload",
  });

  const handleUpload = async () => {
    if (!file) return;

    // Passing file objects automatically triggers multipart/form-data conversion!
    const result = await mutate({
      title: "My Profile Avatar",
      file: file,
    });

    console.log("Upload successful:", result);
  };

  return (
    <div>
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button onClick={handleUpload} disabled={loading}>
        {loading ? "Uploading…" : "Upload Avatar"}
      </button>
    </div>
  );
}
```

---

## 🛠 Features

- **Automatic Multipart Form-Data Conversion**: Pass any JavaScript object with embedded Web `File`/`Blob` or React Native `{ uri, name, type }` objects. `@cellsweb/rpc-client` automatically builds `FormData` and posts seamlessly!
- **Header & Body Merging**: Configure `defaultHeaders` and `defaultBody` globally or dynamically per request.
- **Race Condition Prevention**: `useRpcQuery` utilizes monotonic execution counters to guarantee outdated out-of-order responses never overwrite fresh state.
- **AbortSignal & Timeout Coordination**: Clean cancellation via `signal` with distinct `timeout` (status 408) and `aborted` error codes, with zero memory listener leaks.
- **Payload Shape Preservation**: Transmits arrays, primitives, and objects in their authentic shapes without unwanted spreading.
- **Typed Error Handling**: Catches server RPC error responses and throws `RpcError` with `code`, `message`, `status`, and `meta`.
- **Zero Overhead**: Focused exclusively on clean, high-performance RPC API dispatching.

---

## 📜 API Reference

### `createRpcClient(config)`
- `baseUrl`: Base URL of the CellsWeb server.
- `rpcEndpoint`: Endpoint path (default `"/rpc"`).
- `defaultHeaders`: Additional headers object or dynamic getter function.
- `defaultBody`: Default properties to merge into request payloads.
- `timeoutMs`: Request timeout in milliseconds (default `30000`).

### `rawRpcRequest(options)`
- `baseUrl`: Full base URL.
- `namespace`: RPC namespace string.
- `functionName`: RPC function name string.
- `data`: Payload object.
- `headers`: Additional headers object.
- `multipart`: Force `multipart/form-data` encoding.

---

## 📄 License

MIT © [Minhazur Rahman](https://github.com/MinhazurSarker)
