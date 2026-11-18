# CellsWeb RPC Node

Typed RPC functions, middleware, JSON/multipart intake and server-rendered docs
for Node and Bun. The API endpoint accepts `{namespace,functionName,data}`;
handlers remain independent of the HTTP adapter.

## Install the released packages

Public releases: **@cellsweb/rpc-core@1.0.34**, **@cellsweb/rpc-client@1.0.24** and
**create-cellsweb-rpc-api@1.0.30**. Generate an application from npm:

```sh
npm create cellsweb-rpc-api@latest my-api -- --framework=node --yes
cd my-api
npm run typecheck
npm run build
npm test
npm start
```

For reproducible scaffolding, use `npx create-cellsweb-rpc-api@1.0.30 my-api
--framework=node --yes`. For an existing application, install the SDK you need:
`npm install @cellsweb/rpc-core@1.0.34` or
`npm install @cellsweb/rpc-client@1.0.24`.

Node 24 LTS is primary; packages require Node>=24.0.0. Verified toolchains include
Node 24.0.0/24.15.0 and Bun 1.3.11. Choose Node, Bun, Elysia, Express, Fastify, Hono
or Ultimate Express. Older Node versions may work naturally but are outside the
declared support range. See [installation](docs/getting-started.md).

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
