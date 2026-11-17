# CellsWeb RPC Node

Typed RPC functions, middleware, JSON/multipart intake and server-rendered docs
for Node and Bun. The API endpoint accepts `{namespace,functionName,data}`;
handlers remain independent of the HTTP adapter.

## Release status

This branch prepares **core 1.0.34, client 1.0.24 and scaffolder 1.0.30**. They are
not published by this work. Public versions checked during preparation are
core 1.0.33/client 1.0.23/scaffolder 1.0.29 and do not contain every candidate fix.
Use the local tarball workflow in [RELEASE.md](RELEASE.md) for candidate testing.
After approved publication, the normal scaffold command is:

```sh
npx create-cellsweb-rpc-api@1.0.30 my-api --framework=node
cd my-api
npm run typecheck
npm run build
npm test
npm start
```

Node 24 LTS is the primary runtime; packages declare Node >=24.0.0. Older Node
versions may work naturally but are not promised by that range. Bun is tested
separately (1.3.11); no Node 20 compatibility shim was introduced. Choose from
Node, Bun, Elysia, Express, Fastify, Hono and Ultimate Express templates.

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
- [Candidate migration notes](CHANGELOG.md), [release gates](RELEASE.md)

For source development: `pnpm install`, `pnpm build`, `pnpm typecheck`, `pnpm test`.
Seven-adapter HTTP and multipart probes are part of the scaffolder test suite.
Benchmark fixtures are under `benchmarks`; results describe that workload and
hardware, not a latency, memory or security guarantee.
