---
layout: default
title: Universal Client SDK & React Hooks
nav_order: 8
---

# Universal Client SDK & React Hooks

The **`@cellsweb/rpc-client`** package provides a universal TypeScript client for Web, React, Next.js, and React Native / Expo applications.

---

## 📦 Installation

```bash
pnpm add @cellsweb/rpc-client
# or
npm install @cellsweb/rpc-client
```

---

## 🚀 Creating an RPC Client

```typescript
import { createRpcClient } from "@cellsweb/rpc-client";

export const rpc = createRpcClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/rpc",
  // Dynamic header resolution (e.g. read auth token from local storage)
  defaultHeaders: () => ({
    authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  }),
});
```

### Making Direct Requests

```typescript
try {
  const profile = await rpc.request({
    namespace: "user",
    functionName: "getProfile",
    data: { id: "usr_101" },
  });

  console.log(profile.name, profile.email);
} catch (err) {
  if (err instanceof RpcError) {
    console.error(`RPC Error [${err.code}]:`, err.message, err.details);
  }
}
```

---

## ⚡ Standalone Direct Caller (`rawRpcRequest`)

In non-React contexts (Next.js middleware, Zustand stores, `AuthProvider.tsx`), React hooks cannot be used. Use `rawRpcRequest`:

```typescript
import { rawRpcRequest } from "@cellsweb/rpc-client";

export async function checkSession(token: string) {
  return await rawRpcRequest({
    baseUrl: "http://localhost:4000/rpc",
    namespace: "auth",
    functionName: "verifyToken",
    data: { token },
  });
}
```

---

## ⚛️ React & Next.js Hooks

Wrap your application in `<RpcProvider>`:

```tsx
// app/providers.tsx or index.tsx
import { RpcProvider } from "@cellsweb/rpc-client";
import { rpc } from "@/lib/rpc";

export function Providers({ children }: { children: React.ReactNode }) {
  return <RpcProvider client={rpc}>{children}</RpcProvider>;
}
```

### 1. `useRpcQuery` (Data Fetching)
Features query deduplication, automatic dependency re-fetching, and monotonic race-condition protection:

```tsx
import { useRpcQuery } from "@cellsweb/rpc-client";

export function UserProfile({ userId }: { userId: string }) {
  const { data, loading, error, refetch } = useRpcQuery("user", "getProfile", {
    id: userId,
  });

  if (loading) return <div>Loading profile...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.email}</p>
      <button onClick={() => refetch()}>Refresh</button>
    </div>
  );
}
```

### 2. `useRpcMutation` (Updates & Actions)

```tsx
import { useRpcMutation } from "@cellsweb/rpc-client";
import { useState } from "react";

export function UpdateEmailForm() {
  const [email, setEmail] = useState("");
  const { mutate, loading, error } = useRpcMutation("user", "updateEmail");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await mutate({ email });
    alert("Email updated successfully!");
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit" disabled={loading}>
        {loading ? "Updating..." : "Save"}
      </button>
      {error && <p style={{ color: "red" }}>{error.message}</p>}
    </form>
  );
}
```
