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
