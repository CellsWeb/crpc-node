# Server adapters

The seven complete generated templates are the tested integration examples.
Generate each with `--framework=<name>` rather than copying an incomplete body
parser or converting binary buffers through strings.

| Template | Runtime | Integration |
|---|---|---|
| node | Node 24 | http.createServer with awaited CoreRPC.createHandler |
| express | Node 24 | native request/response handler |
| fastify | Node 24 | fastifyPlugin; scoped multipart stream parser |
| ultimate-express | Node 24 | native handler; framework-specific end/close lifecycle |
| hono | Node 24 with @hono/node-server | CoreRPC.fetch via createHonoHandler |
| bun | Bun | Fetch handler/Bun.serve |
| elysia | Bun | Fetch handler with adapter parse behavior |

<!-- compile: adapters.ts -->
```typescript
import http from 'node:http';
import { CoreRPC } from '@cellsweb/rpc-core';
export async function nodeServer() {
  const rpc = new CoreRPC({ functionsDir: './dist/functions', middlewaresDir: './dist/middlewares', docs: false });
  return { rpc, server: http.createServer(await rpc.createHandler()) };
}
```

There is no `init()` method. For Fastify register `rpc.fastifyPlugin()`; it keeps
multipart stream parsing within the plugin scope, preserving JSON parsing.
For Hono apply the factory to the Hono instance: `rpc.honoPlugin()(honoApp)`.
For Elysia `.use(rpc.elysiaPlugin())` is the plugin factory; the generated full
template additionally handles static binary responses. Follow the tested
templates when mounting complete services.

`rpc.fetch(request)` accepts a Web Request. Documentation uses its parsed pathname
so queries/absolute URLs do not break details. Native and Fetch intake share
logical contracts but buffering/lifecycle differ. Hono's tested host here is
Node, not Cloudflare/Deno/Edge: CoreRPC discovery uses Node filesystem APIs.
No unsupported Edge deployment guarantee is implied by a Fetch-shaped handler.

Keep multipart routing headers/body redundant and consistent. Do not consume a
multipart stream in unrelated middleware before CRPC. See [uploads](uploads.md)
and [global docs controls](interactive-docs.md); production guards apply to all
seven generated templates. Application errors retain default HTTP 200 envelopes.
