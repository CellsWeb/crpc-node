# Client SDK and React

Install `@cellsweb/rpc-client@1.0.24` from public npm. React is optional and
has its own `@cellsweb/rpc-client/react` entry. The package supplies JSON and
multipart callers; see [installation](getting-started.md).

<!-- compile: client.ts -->
```typescript
import { createRpcClient, RpcError } from '@cellsweb/rpc-client';
export const rpc = createRpcClient({ baseUrl: 'http://localhost:4000/rpc',
  defaultHeaders: () => ({ authorization: 'Bearer replace-with-current-credential' }) });
export async function hello(name: string) {
  try { return await rpc.request<{ greeting: string }>({ namespace: 'public', functionName: 'hello', data: { name } }); }
  catch (error) { if (error instanceof RpcError) console.error(error.code, error.details); throw error; }
}
```

`request` unwraps successful data and throws RpcError for structured RPC failures.
Forward current credentials via headers, not a caller-supplied trusted context.
Do not infer application success solely from HTTP 200. `rawRpcRequest` is also a
standalone unwrapped caller; its name does not mean it returns the raw envelope.

## Multipart fetch configuration (unreleased source)

The source fix pending the next client release makes standard browser FormData
use the configured fetchFn even when XMLHttpRequest exists. **Published1.0.24
still bypasses fetchFn for browser multipart when XHR is available.** Installing
that version does not install this unreleased correction.

A web fetch wrapper can supply credentials and intercept multipart requests:

```typescript
const rpcWithCookies = createRpcClient({
  baseUrl: 'https://api.example.com/rpc',
  fetchFn: (url, init) => fetch(url, { ...init, credentials: 'include' }),
});
```

Cross-origin cookies also require the server's appropriate CORS configuration.
Preserve the supplied headers, body and signal in wrappers; use new Headers when
editing headers. Never supply a manual multipart Content-Type/boundary. Timeout,
abort and structured RPC error handling remain the client's responsibility.

React Native bridge FormData with getParts() retains the existing XHR path for
native URI-file compatibility, so fetchFn does not intercept that path. Configure
credentials through defaultHeaders/per-request headers there. No runtime global
marker, new transport option or upload-progress API is introduced. Top-level
files/direct arrays remain supported and nested files remain rejected.

<!-- compile: react-client.tsx -->
```tsx
import type { ReactNode } from 'react';
import { createRpcClient } from '@cellsweb/rpc-client';
import { RpcProvider, useRpcQuery, useRpcMutation } from '@cellsweb/rpc-client/react';
const rpc = createRpcClient({ baseUrl: 'http://localhost:4000/rpc' });
export function Provider({ children }: { children: ReactNode }) { return <RpcProvider client={rpc}>{children}</RpcProvider>; }
export function Greeting({ name }: { name: string }) {
  const query = useRpcQuery<{ greeting: string }, { name: string }>({ namespace: 'public', functionName: 'hello', data: { name } });
  const mutation = useRpcMutation<{ greeting: string }, { name: string }>({ namespace: 'public', functionName: 'hello' });
  return <button disabled={query.loading || mutation.loading} onClick={() => { void mutation.mutate({ name }).catch(console.error); }}>{query.data?.greeting ?? 'Load greeting'}</button>;
}
```

Hooks accept one options object. Query returns `data`, `loading`, `error`,
`refetch`; mutation returns `mutate`, `loading`, `error`, `reset`. Hooks require
RpcProvider. Query deduplication/re-render ordering does not replace server-side
authorization or idempotency handling. Use [multipart](uploads.md) explicitly for
file requests; never manually omit/mismatch the generated routing fields.
