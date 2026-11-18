<p align="center">
  <a href="https://cellsweb.com" target="_blank" rel="noopener noreferrer">
    <img src="https://cellsweb.com/logo.svg" alt="CellsWeb Logo" width="340" style="background: rgba(255, 255, 255, 0.96); padding: 16px 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08); display: inline-block; max-width: 100%;" />
  </a>
</p>

# CellsWeb RPC Node

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

Build schema-validated RPC functions with a shared middleware pipeline across
Node/Bun HTTP adapters. See [release status and installation](getting-started.md)
for core 1.0.35, client 1.0.26 and scaffolder 1.0.31.

- [Functions](functions.md) and [schemas](schemas.md)
- [Middleware and authentication](middlewares.md)
- [Client/React](client.md) and [multipart uploads](uploads.md)
- [Seven adapters](adapters.md) and [global docs controls](interactive-docs.md)
- [CLI](cli.md), [testing](testing.md), [workers](workers.md)
- [Protocol](architecture.md), [API reference](api-reference.md), [Go sibling](crpc-go.md)

Node 24 LTS is primary; declared Node floor 24.0.0 is tested directly. Bun is
tested independently. The deprecated isPublic property is ignored, and auth is
enforced by middleware rather than documentation metadata.

## For contributors

Start with [contribution policy](contributing.md), [development setup](development.md)
and the [internal source map](internals/index.md). The sidebar separates end-user
usage from implementation, testing and release guides. See the [security policy](security.md)
and [Code of Conduct](code-of-conduct.md) before opening a report.

## Start an application

```sh
npm create cellsweb-rpc-api@latest my-api -- --framework=node --yes --pm=npm
cd my-api
npm run typecheck
npm run build
npm test
npm run dev
```

The generated public.hello route accepts `{name:"Ada"}`. Add functions and
middleware with the project-local CLI, then use the HTTP SDK or React provider
in your frontend. Read [functions](functions.md), [client](client.md),
[uploads](uploads.md) and [adapters](adapters.md) for full examples.

Native stream intake and Fetch formData have different buffering boundaries.
Schemas, authentication, output checks and cleanup remain part of the pipeline.
See [execution lifecycle](internals/lifecycle.md) and
[source architecture](internals/index.md) when contributing.
