<p align="center">
  <a href="https://cellsweb.com" target="_blank" rel="noopener noreferrer">
    <img src="https://cellsweb.com/logo.svg" alt="CellsWeb Logo" width="340" style="background: rgba(255, 255, 255, 0.96); padding: 16px 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08); display: inline-block; max-width: 100%;" />
  </a>
</p>

# CellsWeb RPC Node

Typed RPC functions, middleware, JSON/multipart intake and server-rendered docs
for Node and Bun. The API endpoint accepts `{namespace,functionName,data}`;
handlers remain independent of the HTTP adapter.

## Framework overview

CellsWeb RPC organizes applications around typed functions and explicit middleware
rather than a separate HTTP route for each operation. HTTP carries one envelope;
input/output schemas describe contracts and the server keeps authentication state
in middleware-owned context.

| Capability | Node implementation |
|---|---|
| Functions | Co-located constants/run/middlewares/tests; nested namespace discovery |
| Validation | TypeBox input/output contracts, nullable unions and physical file helpers |
| Middleware | Sequential attachments, header/options validation, server-owned context |
| HTTP | Native Node, Bun, Express, Fastify, Hono, Elysia, Ultimate Express |
| Uploads | JSON/multipart, routing consistency, per-request limits and temporary-file cleanup |
| Frontend | Standalone client, React provider/query/mutation hooks, React Native URI assets |
| Developer tooling | Generators, in-process tests, worker opt-in and interactive docs |

The packages have distinct responsibilities:

- [rpc-core](https://www.npmjs.com/package/@cellsweb/rpc-core): server and local CLI.
- [rpc-client](https://www.npmjs.com/package/@cellsweb/rpc-client): browser/mobile/Node client.
- [create-cellsweb-rpc-api](https://www.npmjs.com/package/create-cellsweb-rpc-api): project initializer.
- [Go runtime](https://github.com/CellsWeb/crpc-go): native engine with shared logical contracts.

Choose function-oriented RPC for shared application contracts and upload-heavy
clients. CellsWeb RPC is not GraphQL query selection, gRPC streaming or an
identity provider. Runtime/schema differences between Node and Go remain explicit;
semantic parity does not mean identical implementation or every error detail.

## Install the packages

Release versions: **@cellsweb/rpc-core@1.0.35**, **@cellsweb/rpc-client@1.0.26** and
**create-cellsweb-rpc-api@1.0.31**. Generate an application from npm:

```sh
npm create cellsweb-rpc-api@latest my-api -- --framework=node --yes --pm=npm
cd my-api
npm run typecheck
npm run build
npm test
npm start
```

For reproducible scaffolding, use `npx create-cellsweb-rpc-api@1.0.31 my-api
--framework=node --yes --pm=npm`. For an existing application, install the SDK you need:
`npm install @cellsweb/rpc-core@1.0.35` or
`npm install @cellsweb/rpc-client@1.0.26`.

Node 24 LTS is primary; packages require Node>=24.0.0. Verified toolchains include
Node 24.0.0/24.15.0 and Bun 1.3.11. Choose Node, Bun, Elysia, Express, Fastify, Hono
or Ultimate Express. Older Node versions may work naturally but are outside the
declared support range. See [installation](docs/getting-started.md).

## Function and client quick start

The initializer creates a `public.hello` function. A function's constants export
TypeBox input/output schemas; its handler receives validated input and a
MiddlewareContext. A typical layout is:

```text
src/
  server.ts
  env.ts
  functions/public/hello/{constants.ts,run.ts,middlewares.ts,test.ts}
  middlewares/auth/{constants.ts,run.ts}
  middlewares/rateLimit/{constants.ts,run.ts}
```

After starting the generated server, make a real HTTP call:

```sh
curl http://localhost:4000/rpc -H 'Content-Type: application/json' \
  --data '{"namespace":"public","functionName":"hello","data":{"name":"Ada"}}'
```

A separate client project can call the same function:

<!-- verify-ts: root-node/client.ts -->
```typescript
import { createRpcClient } from '@cellsweb/rpc-client';
const rpc = createRpcClient({ baseUrl: 'http://localhost:4000' });
export async function greet() {
  return rpc.request<{ greeting: string }>({
    namespace: 'public', functionName: 'hello', data: { name: 'Ada' },
  });
}
```

For complete constructor/custom-server, authentication, schema, upload and React
examples, read the standalone package guides:

- [Core README](packages/rpc-core/README.md)
- [Client README](packages/rpc-client/README.md)
- [Scaffolder README](packages/create-cellsweb-rpc-api/README.md)

Create additional modules through the project-local CLI:

```sh
npm run create:function -- --ns catalog --name get --contentType json
npm run create:middleware -- --name tenant --description 'Resolve tenant'
```

## Contracts and execution

Use TypeBox input/output schemas. JSON objects, arrays, scalars and explicit null
reach validation with their shape intact. Omitted HTTP data defaults to `{}`.
Union schemas enforce their declared branches, including file constraints.

Authentication and authorization belong to middleware. HTTP clients forward
credentials in headers; they cannot skip middleware or inject a trusted session.
The generated auth module is a customization stub, not a production identity
provider. Application errors use HTTP 200 envelopes by default; transport errors
and opt-in HTTP status mapping are separate.

`isPublic` is deprecated and ignored. It affects neither execution nor docs.
All registered functions may appear in docs; disable docs globally when needed.
There is no replacement visibility flag. Middleware docs show structural schema
metadata, never resolved option values or defaults.

## Guides

- [Installation and configuration](docs/getting-started.md)
- [Functions](docs/functions.md), [schemas](docs/schemas.md), [middleware](docs/middlewares.md)
- [Client and React](docs/client.md), [uploads](docs/uploads.md), [adapters](docs/adapters.md)
- [Documentation controls](docs/interactive-docs.md), [testing](docs/testing.md), [CLI](docs/cli.md)
- [Protocol and buffering](docs/architecture.md), [Go interoperability](docs/crpc-go.md)
- [Release notes](CHANGELOG.md), [release engineering](RELEASE.md)

For source development: `pnpm install`, `pnpm build`, `pnpm typecheck`, `pnpm test`.
Seven-adapter HTTP and multipart probes are part of the scaffolder test suite.
Benchmark fixtures are under `benchmarks`; results describe that workload and
hardware, not a latency, memory or security guarantee.

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, focused changes and review.
The [development guide](docs/development.md) and
[source map](docs/internals/index.md) explain internals and subsystem tests.
Please follow [the Code of Conduct](CODE_OF_CONDUCT.md); report vulnerabilities
through [the private reporting policy](SECURITY.md). Licensed under
[MIT](LICENSE).
