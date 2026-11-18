<p align="center">
  <a href="https://cellsweb.com" target="_blank" rel="noopener noreferrer">
    <img src="https://cellsweb.com/logo.svg" alt="CellsWeb Logo" width="340" style="background: rgba(255, 255, 255, 0.96); padding: 16px 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08); display: inline-block; max-width: 100%;" />
  </a>
</p>

# @cellsweb/rpc-core

[![npm version](https://img.shields.io/npm/v/@cellsweb/rpc-core.svg)](https://www.npmjs.com/package/@cellsweb/rpc-core)
[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/CellsWeb/crpc-node/blob/main/LICENSE)

The server runtime for **CellsWeb RPC**: write typed functions and middleware,
validate their contracts with TypeBox, and expose them through a single HTTP
RPC endpoint. Share application functions across native Node HTTP, Bun, Express,
Fastify, Hono, Elysia and Ultimate Express adapters.

This **1.0.35 documentation patch** preserves the runtime APIs of 1.0.34.
Node **24 LTS** is the primary runtime; the declared minimum is Node 24.0.0.
Bun is tested separately. Browser/mobile applications use the client package.

| Package | Responsibility |
|---|---|
| [@cellsweb/rpc-core](https://www.npmjs.com/package/@cellsweb/rpc-core) | Server, schemas, adapters, discovery and project-local CLI |
| [@cellsweb/rpc-client](https://www.npmjs.com/package/@cellsweb/rpc-client) | HTTP client, React hooks and React Native multipart support |
| [create-cellsweb-rpc-api](https://www.npmjs.com/package/create-cellsweb-rpc-api) | Generate an application with any of the seven adapters |
| [Go runtime](https://github.com/CellsWeb/crpc-go) | Native Go engine, schemas, HTTP and Node IPC integration |

## Contents

- [Features and architectural fit](#features-and-architectural-fit)
- [Installation](#installation)
- [Executable quick start](#executable-quick-start)
- [Discovery and function contracts](#discovery-and-function-contracts)
- [Server initialization and adapters](#server-initialization-and-adapters)
- [Middleware and authentication](#middleware-and-authentication)
- [Schemas and multipart uploads](#schemas-and-multipart-uploads)
- [Requests, responses and errors](#requests-responses-and-errors)
- [Documentation and configuration](#documentation-and-configuration)
- [Testing, workers and generators](#testing-workers-and-generators)
- [Guides, contributing and license](#guides-contributing-and-license)

## Features and architectural fit

- Directory-based function discovery and indexed namespace/function lookup.
- Input/output validation with compiled TypeBox validators and cached schemas.
- Ordered middleware with validated options/headers and server-owned context.
- JSON objects, arrays, scalars and explicit null preserve their input shape.
- Busboy multipart intake on native Node streams, file constraints and cleanup.
- Fetch Request/Response entrypoint, framework adapters and CORS handling.
- Generated function/middleware documentation with structural schemas.
- In-process calls for tests, CLI generators and opt-in worker execution.

CellsWeb RPC fits applications that want function-oriented HTTP calls, shared
schema contracts, uploads and browser/mobile clients without a service-codegen
step. It does not provide GraphQL selection sets, gRPC streaming or an identity
provider. Choose based on your transport and deployment requirements, not a
universal performance ranking. Benchmarks describe their measured workload;
there is no zero-overhead, zero-buffering or security-certification promise.

## Installation

For an existing TypeScript application:

```sh
npm install @cellsweb/rpc-core@1.0.35 @sinclair/typebox
npm install --save-dev typescript tsx @types/node
```

Or create a complete application:

```sh
npm create cellsweb-rpc-api@latest my-api -- --framework=node --yes --pm=npm
cd my-api
npm run typecheck
npm run build
npm test
npm start
```

The initializer installs a server project. It does not install the browser SDK
into your frontend; install `@cellsweb/rpc-client` there separately.

## Executable quick start

Start an empty ESM project (`npm init -y`, then `npm pkg set type=module`), install
the dependencies above, and create these files:

```text
server.ts
src/
  functions/public/hello/
    constants.ts
    run.ts
  middlewares/
```

`src/functions/public/hello/constants.ts`:

<!-- verify-ts: core/src/functions/public/hello/constants.ts -->
```typescript
import { Type, type Static } from '@sinclair/typebox';
export const metadata = { description: 'Greet a named caller', tags: ['example'] };
export const contentType = 'application/json';
export const inputSchema = Type.Object({ name: Type.String({ minLength: 1 }) });
export const outputSchema = Type.Object({ greeting: Type.String() });
export type Input = Static<typeof inputSchema>;
export type Output = Static<typeof outputSchema>;
```

`src/functions/public/hello/run.ts`:

<!-- verify-ts: core/src/functions/public/hello/run.ts -->
```typescript
import type { MiddlewareContext } from '@cellsweb/rpc-core';
import type { Input, Output } from './constants.js';
export async function run(input: Input, _context: MiddlewareContext): Promise<Output> {
  return { greeting: `Hello, ${input.name}!` };
}
```

`server.ts`:

<!-- verify-ts: core/server.ts -->
```typescript
import { CoreRPC } from '@cellsweb/rpc-core';
const app = new CoreRPC({
  functionsDir: './src/functions',
  middlewaresDir: './src/middlewares',
  port: 4000,
});
await app.start();
```

Run `npx tsx server.ts`, then:

```sh
curl http://localhost:4000/rpc \
  -H 'Content-Type: application/json' \
  --data '{"namespace":"public","functionName":"hello","data":{"name":"Ada"}}'
```

The success envelope contains `{"status":"ok","data":{"greeting":"Hello, Ada!"}}`
and request metadata. Send `{"name":123}` to see an input-validation error.
In development, open `http://localhost:4000/docs` for the generated UI.

## Discovery and function contracts

`functionsDir` defaults to `src/functions`; `middlewaresDir` defaults to
`src/middlewares`. Each function has `run.ts` or `run.js`. Contracts live in
`constants.ts`, and attachments in `middlewares.ts`. A named `run` or default
handler is accepted. For `functions/catalog/product/get/run.ts`, discovery uses
namespace `catalog.product`, functionName `get`, and key `catalog.product.get`.

`metadata.description`, `tags` and `deprecated` describe the function. Legacy
`isPublic` is deprecated and ignored; it does not hide docs or authorize calls.
Functions may declare a headersSchema, inputSchema, outputSchema and contentType.
Register/discover before serving; live registry mutation is not a supported
concurrency model. See [function contracts](https://cellsweb.github.io/crpc-node/functions/).

## Server initialization and adapters

The constructor, instance setters and static builder configure the same engine:

<!-- verify-ts: core/initialization.ts -->
```typescript
import { CoreRPC } from '@cellsweb/rpc-core';
export const direct = new CoreRPC({ functionsDir: 'src/functions', port: 4000 });
export const setters = new CoreRPC().setFunctionDir('src/functions').setPort(4000);
export const builder = CoreRPC.configure().useFunctions('src/functions').setPort(4000);
```

For a custom native Node HTTP server, await the handler first:

<!-- verify-ts: core/custom-server.ts -->
```typescript
import { createServer } from 'node:http';
import { CoreRPC } from '@cellsweb/rpc-core';
const app = new CoreRPC({ functionsDir: 'src/functions' });
const handler = await app.createHandler();
export const server = createServer(handler);
// server.listen(4000); call server.close() when your application shuts down.
```

| Adapter | Integration |
|---|---|
| Native Node | `app.start()` or `await app.createHandler()` with node:http |
| Express | Mount the awaited Node handler on `/rpc`, plus docs/health as needed |
| Fastify | `fastify.register(app.fastifyPlugin())` |
| Ultimate Express | Mount the awaited Node handler on its request/response routes |
| Hono | `app.honoPlugin()` or `app.createHonoHandler()` |
| Elysia | `app.elysiaPlugin()` |
| Native Bun | `await app.serveBun()` |

`await app.fetch(new Request(...))` is the Web Standards entrypoint. Use the
scaffolder's adapter templates for complete mounting, docs and health routes.
Hono/Fetch support does not promise directory discovery in an Edge runtime.
See [adapter examples](https://cellsweb.github.io/crpc-node/adapters/).

## Middleware and authentication

Middleware is application code. It receives `({headers, options, function},
context)` and returns the context passed to subsequent stages. Node validates
declared middleware options/header schemas, then runs attachments sequentially.
Missing attached middleware fails closed.

A demonstration API-key middleware (replace this integration with your identity
provider for production):

`src/middlewares/auth/constants.ts`:

<!-- verify-ts: core/src/middlewares/auth/constants.ts -->
```typescript
import { Type } from '@sinclair/typebox';
export const metadata = { description: 'Verify an application API key' };
export const optionsSchema = Type.Object({});
export const headersSchema = Type.Object({ 'x-api-key': Type.Optional(Type.String()) });
```

`src/middlewares/auth/run.ts`:

<!-- verify-ts: core/src/middlewares/auth/run.ts -->
```typescript
import { AppError, ErrorCode, type MiddlewareFn } from '@cellsweb/rpc-core';
export const run: MiddlewareFn = async ({ headers }, context) => {
  const expected = process.env.DEMO_API_KEY;
  if (!expected || headers['x-api-key'] !== expected)
    throw new AppError(ErrorCode.UNAUTHORIZED, 'Valid API key required');
  return { ...context, auth: { subject: 'api-key-client' } };
};
```

To protect hello, add `src/functions/public/hello/middlewares.ts`:

<!-- verify-ts: core/src/functions/public/hello/middlewares.ts -->
```typescript
import { defineMiddlewares } from '@cellsweb/rpc-core';
export const middlewares = defineMiddlewares([{ name: 'auth', options: {} }]);
```

Restart with `DEMO_API_KEY` exported, then supply `X-API-Key` in the request.
Do not place secrets in function metadata or documentation descriptions.

Authentication and authorization belong to middleware, never `isPublic` or a
caller-provided session/context object. Forward credentials as headers. The
scaffolded auth module is a customization stub, not production verification.
Its `rateLimit` middleware is an in-memory example: tune the policy and choose a
shared store when limits must span processes. See [middleware guide](https://cellsweb.github.io/crpc-node/middlewares/).

## Schemas and multipart uploads

Use TypeBox for JSON contracts. The declared union branches remain enforced;
nullable schemas accept explicit null only if a null branch is present. Omitted
HTTP data defaults to `{}`. Do not use a file branch as a wildcard.

`File` and `Files` represent physical UploadedFile instances; `FormNum` and
`FormBool` decode supported multipart text values. An upload contract:

<!-- verify-ts: core/src/functions/public/upload/constants.ts -->
```typescript
import { Type, type Static } from '@sinclair/typebox';
import { File, Files, FormNum, FormBool } from '@cellsweb/rpc-core';
export const contentType = 'multipart/form-data';
export const metadata = { description: 'Inspect uploaded files' };
export const inputSchema = Type.Object({
  avatar: File({ maxSizeBytes: 5 * 1024 * 1024, mimeTypes: ['image/png'] }),
  documents: Type.Optional(Files({ maxCount: 3, maxSizeBytes: 1024 * 1024 })),
  count: FormNum({ minimum: 0 }),
  publish: FormBool(),
});
export const outputSchema = Type.Object({ filename: Type.String(), bytes: Type.Number() });
export type Input = Static<typeof inputSchema>;
```

<!-- verify-ts: core/src/functions/public/upload/run.ts -->
```typescript
import type { Input } from './constants.js';
export async function run(input: Input) {
  return { filename: input.avatar.filename, bytes: input.avatar.byteLength };
}
```

The client SDK constructs routing headers and redundant text fields for you.
Without the SDK, put namespace/functionName text parts before files; send both
routing headers or neither, and ensure they agree with the body. Do not set a
multipart boundary yourself when using FormData.

Uploads support top-level files and direct arrays, not nested file-in-object
structures. Node UploadedFile exposes `path`, `filename`, `byteLength`,
`mimeType`, `declaredMimeType`, `detectedMimeType`, `createReadStream()`,
`toBuffer()` and `toBlob()`. Persist to an application-owned unique location
inside the handler if needed; temporary inputs are cleaned after processing.
Never use an untrusted filename as a destination path.

Native Node/Express/Fastify/Ultimate Express use Busboy stream intake; Fetch's
`request.formData()` in Bun/Hono/Elysia can buffer at the runtime interface.
Limits are per request, not an aggregate-memory guarantee. MIME checks are not
content sanitization. Server-side arrays may reflect asynchronous file-write
completion order; do not rely on arrival order as a business identifier.

## Requests, responses and errors

```json
{"namespace":"public","functionName":"hello","data":{"name":"Ada"}}
```

```json
{"status":"ok","data":{"greeting":"Hello, Ada!"},"meta":{"requestId":"example","durationMs":1}}
```

```json
{"status":"error","code":"validation_error","message":"Input validation failed","details":[]}
```

Handled application errors use HTTP 200 by default, including authorization and
schema failures. Transport/framing failures, unknown HTTP paths and optional
`useHttpStatusCodes:true` mappings are separate. Inspect the envelope, not only
HTTP status. Throw `new AppError(ErrorCode.FORBIDDEN, 'Insufficient permission')`
for an intentional application failure. Unexpected errors become structured
internal errors. Output validation runs before HTTP success; it is not disabled
to accommodate invalid handler results.

## Documentation and configuration

Core options include functionsDir, middlewaresDir, rpcEndpoint, docsEndpoint,
healthEndpoint, port, host, docs, strict, cors, trustProxy, useHttpStatusCodes and
onTelemetry. Await `getRegistry()` to access discovered metadata. There is no
`init()` lifecycle method.

| Control | Behavior |
|---|---|
| Explicit `docs:false` | Disable all framework docs routes |
| Core `NODE_ENV=production` | Docs disabled unless API_DOCS_ENABLED is exactly `true` |
| Core outside production | Docs enabled by default; use explicit docs:false to disable |
| `API_DOCS_ENDPOINT` | Core documentation path, default `/docs` |
| Scaffold `API_DOCS_ENABLED` | Parsed application env boolean; true/false honored by all templates |
| `trustProxy` | Explicitly opt in before trusting forwarded client IPs |

Explicit application configuration wins over core environment defaults. Generated
projects additionally load/parse `.env` in src/env.ts, then pass explicit values.
Public docs may show every registered function. Deprecated isPublic is ignored;
there is no replacement per-function visibility flag. Middleware docs show
structural schemas, not live secret option values. See [global docs controls](https://cellsweb.github.io/crpc-node/interactive-docs/).

## Testing, workers and generators

For local in-process tests:

<!-- verify-ts: core/local-call.ts -->
```typescript
import { CoreRPC, createTestCaller } from '@cellsweb/rpc-core';
const app = new CoreRPC({ functionsDir: 'src/functions', middlewaresDir: 'src/middlewares' });
export const caller = createTestCaller(app);
// With the optional auth attachment, supply headers matching your test setup.
export async function greet() {
  return caller.call<{ greeting: string }>('public.hello', { name: 'Ada' });
}
```

`caller.call` unwraps data or throws; `callRaw` and `app.execute` return execution
envelopes. They run the configured pipeline. Add focused regression tests for
success, validation, authorization, interruption and cleanup when relevant.

For CPU-bound work, `export const worker = true` in a function's constants opts
into worker execution. Keep worker inputs/context serializable; workers are not
a way to transfer arbitrary application resources. See [worker guide](https://cellsweb.github.io/crpc-node/workers/).

The project-local `crpc` binary supports dev, build, start, test and generators:

```sh
npm run create:function -- --ns catalog --name get --contentType json
npm run create:middleware -- --name tenant --description 'Resolve tenant'
npm run typecheck
npm run build
npm test
```

For automation, the public programmatic helpers create the same co-located files:

<!-- verify-ts: core/generate.ts -->
```typescript
import path from 'node:path';
import { scaffoldFunction, scaffoldMiddleware } from '@cellsweb/rpc-core';
export async function addCatalogFunction(projectRoot: string) {
  await scaffoldMiddleware({ name: 'tenant', description: 'Resolve tenant',
    targetDir: path.join(projectRoot, 'src/middlewares') });
  return scaffoldFunction({ namespace: 'catalog', name: 'get', contentType: 'json',
    middlewares: ['tenant'], targetDir: path.join(projectRoot, 'src/functions') });
}
```

Run generators against an application-owned project directory, then implement its
business logic and credential checks. Use the exported option types when adding
custom automation. CLI testing/audit reports are development tools,
not a security certification. See [CLI](https://cellsweb.github.io/crpc-node/cli/)
and [testing](https://cellsweb.github.io/crpc-node/testing/).

## Guides, contributing and license

[Full documentation](https://cellsweb.github.io/crpc-node/) ·
[Source](https://github.com/CellsWeb/crpc-node/tree/main/packages/rpc-core) ·
[Contributing](https://github.com/CellsWeb/crpc-node/blob/main/CONTRIBUTING.md) ·
[Private security reporting](https://github.com/CellsWeb/crpc-node/security/policy) ·
[Go documentation](https://cellsweb.github.io/crpc-go/)

MIT ©2026 CellsWeb. See [LICENSE](https://github.com/CellsWeb/crpc-node/blob/main/LICENSE).
