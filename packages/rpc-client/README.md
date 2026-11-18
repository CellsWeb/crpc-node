<p align="center">
  <a href="https://cellsweb.com" target="_blank" rel="noopener noreferrer">
    <img src="https://cellsweb.com/logo.svg" alt="CellsWeb Logo" width="340" style="background: rgba(255, 255, 255, 0.96); padding: 16px 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08); display: inline-block; max-width: 100%;" />
  </a>
</p>

# @cellsweb/rpc-client

[![npm version](https://img.shields.io/npm/v/@cellsweb/rpc-client.svg)](https://www.npmjs.com/package/@cellsweb/rpc-client)
[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/CellsWeb/crpc-node/blob/main/LICENSE)

The **CellsWeb RPC** HTTP client for TypeScript/JavaScript, browsers, Node,
React and React Native. Make typed function calls, forward credentials, upload
files and handle structured errors. React consumers also get a provider, query
hook and mutation hook through the separate `/react` entrypoint.

This **1.0.26 documentation patch** preserves the implementation from 1.0.25,
including browser multipart honoring a custom fetchFn. Node tooling/runtime
requires Node>=24.0.0; browser and React Native support use their own networking
APIs. React is an optional peer (>=16.8.0), unnecessary for base-package usage.

| Ecosystem package | Purpose |
|---|---|
| [@cellsweb/rpc-core](https://www.npmjs.com/package/@cellsweb/rpc-core) | Node/Bun server, discovery, schemas and adapters |
| [@cellsweb/rpc-client](https://www.npmjs.com/package/@cellsweb/rpc-client) | This HTTP SDK and optional React hooks |
| [create-cellsweb-rpc-api](https://www.npmjs.com/package/create-cellsweb-rpc-api) | Generate a server application |
| [CellsWeb RPC Go](https://github.com/CellsWeb/crpc-go) | Go server using the same logical RPC envelope |

## Contents

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Reusable configuration and authentication](#reusable-configuration-and-authentication)
- [React provider and hooks](#react-provider-and-hooks)
- [Multipart and binary files](#multipart-and-binary-files)
- [React Native](#react-native)
- [Errors, cancellation and timeouts](#errors-cancellation-and-timeouts)
- [API reference](#api-reference)
- [Documentation and license](#documentation-and-license)

## Features

- `rawRpcRequest` for a service, background task or one-off call without React.
- `createRpcClient` / RpcClient for shared URL, dynamic headers and timeouts.
- Automatic FormData selection for supported file values; optional forced multipart.
- Browser custom fetch integration for credentials/interceptors, including uploads.
- RPC envelope unwrapping with typed RpcError codes, details and metadata.
- Caller AbortSignal and timeout coordination with distinct failure codes.
- Query stale-result suppression, manual refetch and mutation loading/error state.
- React Native URI assets through the native FormData/XHR networking bridge.

The response type parameter is a TypeScript declaration, not a runtime schema
validator or generated server contract. The server validates its own schemas.

## Installation

```sh
npm install @cellsweb/rpc-client@1.0.26
```

For React, install React in your application as usual. Import base APIs from
`@cellsweb/rpc-client`, and hooks/provider only from `@cellsweb/rpc-client/react`.
The base entrypoint does not require React.

## Quick start

Use the core README's `public.hello` server, or a generated application's
matching route. Base URLs normally identify the origin; `/rpc` is the default
endpoint. For an existing non-root endpoint, use the complete endpoint URL.

<!-- verify-ts: client/quick-start.ts -->
```typescript
import { rawRpcRequest, createRpcClient } from '@cellsweb/rpc-client';
type Greeting = { greeting: string };
export async function directGreeting() {
  return rawRpcRequest<Greeting>({
    baseUrl: 'http://localhost:4000',
    namespace: 'public', functionName: 'hello', data: { name: 'Ada' },
  });
}
export const rpc = createRpcClient({ baseUrl: 'http://localhost:4000' });
export async function configuredGreeting() {
  const result = await rpc.request<Greeting>({
    namespace: 'public', functionName: 'hello', data: { name: 'Ada' },
  });
  return result.greeting;
}
```

The SDK posts `{namespace,functionName,data}` and returns the envelope's data.
For `{status:'error',code,message,...}`, it throws RpcError even when HTTP status
is200. It works with the Node/Bun engine and compatible Go routes.

## Reusable configuration and authentication

Dynamic headers may be synchronous or asynchronous. Read credentials when the
call starts rather than capturing an obsolete login token:

<!-- verify-ts: client/auth.ts -->
```typescript
import { createRpcClient } from '@cellsweb/rpc-client';
export function createAuthenticatedClient(readToken: () => Promise<string>) {
  return createRpcClient({
    baseUrl: 'https://api.example.com',
    defaultHeaders: async () => ({ authorization: `Bearer ${await readToken()}` }),
    defaultBody: { appId: 'web' },
    timeoutMs: 15_000,
    fetchFn: (url, init) => fetch(url, { ...init, credentials: 'include' }),
  });
}
```

`defaultBody` merges with object input; request data wins on duplicate keys.
Arrays, strings, numbers, booleans and explicit null preserve their shape rather
than being object-spread. Omitted data uses defaultBody or `{}`. JSON does not
carry a trusted session merely because a field is named `context` or `user`.

Pass per-call `headers` to override matching defaults. Supply real credentials;
a server middleware validates them and establishes identity/authorization.
Deprecated `isPublic` metadata has no auth effect. There is no remote middleware
skip option. Cookie-based cross-origin requests also require compatible server
CORS/credential policy; custom fetch alone does not override browser policy.

Standard browser FormData uses fetchFn even if XMLHttpRequest exists. Native
bridge FormData is a separate transport; see [React Native](#react-native).

## React provider and hooks

The example below uses the same hello contract. Mount GreetingApp at your React
root. RpcProvider accepts either a preconfigured client or its configuration.
Hooks take one options object, not positional namespace/function arguments.

<!-- verify-ts: client/react-example.tsx -->
```tsx
import React, { useState } from 'react';
import { createRpcClient } from '@cellsweb/rpc-client';
import { RpcProvider, useRpcQuery, useRpcMutation } from '@cellsweb/rpc-client/react';
const client = createRpcClient({ baseUrl: 'http://localhost:4000' });
type Greeting = { greeting: string };
type Input = { name: string };
function GreetingPanel() {
  const [lastGreeting, setLastGreeting] = useState<string>();
  const query = useRpcQuery<Greeting, Input>({
    namespace: 'public', functionName: 'hello', data: { name: 'Ada' },
  });
  const mutation = useRpcMutation<Greeting, Input>({
    namespace: 'public', functionName: 'hello',
  });
  return <section>
    {query.loading && <p>Loading…</p>}
    {query.error != null && <p>Could not load the greeting.</p>}
    <p>{query.data?.greeting}</p>
    <button onClick={() => { void query.refetch().catch(() => {}); }}>Refresh</button>
    <button disabled={mutation.loading}
      onClick={() => { void mutation.mutate({ name: 'Grace' }).then(result => setLastGreeting(result.greeting)).catch(() => {}); }}>
      Greet Grace
    </button>
    <p>{lastGreeting}</p>
    {mutation.error != null && <p>Could not send the greeting.</p>}
  </section>;
}
export function GreetingApp() {
  return <RpcProvider client={client}><GreetingPanel /></RpcProvider>;
}
```

`useRpcQuery` auto-runs when enabled (default true) and exposes data/loading/error/
refetch. Use `enabled:false` for manual execution. Its execution counters prevent
older query results from overwriting newer state. `useRpcMutation` exposes
mutate/loading/error/reset and optional onSuccess/onError callbacks.
The result is returned by `await mutate(...)`; keep it in application state if needed.
Handle the returned promises; reading the error state does not consume a rejected
manual refetch/mutate promise. Memoize callback props when their identity matters.

## Multipart and binary files

Pass a real browser File/Blob or direct array of files as a top-level field.
The SDK detects supported file values automatically; `multipart:true` can force
FormData. Let the transport supply Content-Type and its boundary.

<!-- verify-ts: client/upload.ts -->
```typescript
import { createRpcClient } from '@cellsweb/rpc-client';
const rpc = createRpcClient({ baseUrl: 'http://localhost:4000' });
export async function uploadAvatar(avatar: File, documents: File[]) {
  return rpc.request<{ filename: string; bytes: number }>({
    namespace: 'public', functionName: 'upload', multipart: true,
    data: { avatar, documents, count: documents.length, publish: false },
  });
}
```

The matching core README upload contract limits avatar MIME/size and direct file
arrays. Empty files retain their bytes/size and must satisfy the server's rules.
Nested structures such as `{profile:{avatar:file}}` are rejected, not silently
serialized. Group related files using top-level fields/direct arrays.

The SDK supplies both routing headers and redundant namespace/functionName text
parts. Do not overwrite those with conflicting routing values. The Node server's
same-name arrays may be ordered by asynchronous file-write completion; use
explicit identifiers rather than relying on result order. Binary bytes and
outgoing client part order are preserved.

Uploaded files are temporary server inputs. Persist during handler processing
to application-owned storage if needed. The client does not manage destination
storage, sanitize content or bypass server limits.

## React Native

Use the same base SDK/hooks. A native picked file is represented by a URI, name
and MIME type; obtain a real accessible URI from your application's picker.

<!-- verify-ts: client/native.ts -->
```typescript
import { createRpcClient } from '@cellsweb/rpc-client';
const rpc = createRpcClient({ baseUrl: 'https://api.example.com' });
export async function uploadNativeAvatar(uri: string, bearerToken: string) {
  return rpc.request<{ filename: string; bytes: number }>({
    namespace: 'user', functionName: 'uploadAvatar', multipart: true,
    headers: { authorization: `Bearer ${bearerToken}` },
    data: { avatar: { uri, name: 'avatar.jpg', type: 'image/jpeg' } },
  });
}
```

Native bridge FormData exposes getParts() consumed by RCTNetworking. The SDK keeps
XHR for that representation, including Hermes/native URI-file handling. It does
not select XHR merely because a browser has XMLHttpRequest. A configured fetchFn
is used for JSON and standard web FormData, **not for native bridge multipart**;
put native upload credentials in defaultHeaders/per-request headers.

Pinned RN 0.76.9/0.88.1 JS FormData/Blob compatibility has regression coverage.
Physical-device Hermes/RCTNetworking file I/O is not certified by those JS tests;
validate picker URI access and platform networking on your target devices.
There is no public upload-progress callback option in this SDK.

## Errors, cancellation and timeouts

<!-- verify-ts: client/errors.ts -->
```typescript
import { createRpcClient, RpcError } from '@cellsweb/rpc-client';
const rpc = createRpcClient({ baseUrl: 'http://localhost:4000' });
export async function requestWithCancellation(signal: AbortSignal) {
  try {
    return await rpc.request<{ greeting: string }>({
      namespace: 'public', functionName: 'hello', data: { name: 'Ada' },
      timeoutMs: 5_000, signal,
    });
  } catch (error) {
    if (error instanceof RpcError) {
      console.error(error.code, error.message, error.status, error.details, error.meta);
    }
    throw error;
  }
}
```

| Failure | Meaning |
|---|---|
| Server error envelope | Server code/message/details/meta become RpcError |
| `configuration_error` | Missing/invalid baseUrl |
| `parse_error` | Response cannot be parsed as JSON |
| `timeout` | Configured deadline expired (status408) |
| `aborted` | Caller cancellation |
| `network_error` | Networking/transport failure or unsupported multipart construction |

HTTP 200 is expected for successfully handled application errors. A non-JSON
proxy/error page becomes parse_error. There is no automatic RPC replay after a
failure; decide retry safety at the application level. A custom fetch wrapper
must forward the supplied AbortSignal if it wants normal cancellation behavior.

## API reference

| API | Configuration/result |
|---|---|
| `createRpcClient(config)` | Returns RpcClient; equivalent to `new RpcClient(config)` |
| `client.request<TData,TVariables>(options)` | Promise of unwrapped data; throws RpcError |
| `client.getConfig()` | Current client configuration |
| `rawRpcRequest<TData>(options)` | One-off call; no provider/client instance needed |
| `RpcProvider` | client or config plus children |
| `useRpcClient()` | Read the provider's client |
| `useRpcQuery<TData,TVariables>(options)` | Query state and refetch |
| `useRpcMutation<TData,TVariables>(options)` | Mutation state, mutate and reset |

Client config: baseUrl, rpcEndpoint, defaultHeaders, defaultBody, timeoutMs
(default 30000), fetchFn. Request options: namespace, functionName, data, headers,
multipart, timeoutMs, signal. Raw options additionally accept baseUrl,
rpcEndpoint, defaultBody and fetchFn directly. Exports include these option and
response types. Arbitrary server schemas are not inferred from a route name.

## Documentation and license

[Client guide](https://cellsweb.github.io/crpc-node/client/) ·
[Uploads](https://cellsweb.github.io/crpc-node/uploads/) ·
[Source](https://github.com/CellsWeb/crpc-node/tree/main/packages/rpc-client) ·
[Contributing](https://github.com/CellsWeb/crpc-node/blob/main/CONTRIBUTING.md) ·
[Security policy](https://github.com/CellsWeb/crpc-node/security/policy) ·
[Go interop](https://cellsweb.github.io/crpc-go/node-ipc/)

MIT ©2026 CellsWeb. See [LICENSE](https://github.com/CellsWeb/crpc-node/blob/main/LICENSE).
