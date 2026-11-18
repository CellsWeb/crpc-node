<p align="center">
  <a href="https://cellsweb.com" target="_blank" rel="noopener noreferrer">
    <img src="https://cellsweb.com/logo.svg" alt="CellsWeb Logo" width="340" style="background: rgba(255, 255, 255, 0.96); padding: 16px 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08); display: inline-block; max-width: 100%;" />
  </a>
</p>

# create-cellsweb-rpc-api

[![npm version](https://img.shields.io/npm/v/create-cellsweb-rpc-api.svg)](https://www.npmjs.com/package/create-cellsweb-rpc-api)
[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/CellsWeb/crpc-node/blob/main/LICENSE)

The official **CellsWeb RPC** project initializer. Generate a TypeScript RPC
application with function discovery, TypeBox schemas, middleware examples,
JSON/multipart handling, environment configuration and a project-local CLI.
Choose native Node, Bun, Express, Fastify, Hono, Elysia or Ultimate Express while
keeping function and middleware modules independent of the HTTP adapter.

This **1.0.31 documentation patch** preserves the generator/template runtime from
1.0.30. Requires **Node>=24.0.0**, with Node 24 LTS the primary toolchain; Bun 1.3.11
is tested separately. This package generates the project. The installed
`@cellsweb/rpc-core` supplies the project's runtime and `crpc` executable.

| Ecosystem | Responsibility |
|---|---|
| [create-cellsweb-rpc-api](https://www.npmjs.com/package/create-cellsweb-rpc-api) | This initializer and project templates |
| [@cellsweb/rpc-core](https://www.npmjs.com/package/@cellsweb/rpc-core) | Server engine, contracts, adapters and local CLI |
| [@cellsweb/rpc-client](https://www.npmjs.com/package/@cellsweb/rpc-client) | Separate frontend/client SDK, React hooks and native file support |
| [CellsWeb RPC Go](https://github.com/CellsWeb/crpc-go) | Go SDK and its separate Go initializer |

## Contents

- [Quick start](#quick-start)
- [Interactive and automated setup](#interactive-and-automated-setup)
- [Seven supported adapters](#seven-supported-adapters)
- [Generated project structure](#generated-project-structure)
- [Functions and middleware](#functions-and-middleware)
- [Development, build and tests](#development-build-and-tests)
- [Environment and documentation controls](#environment-and-documentation-controls)
- [Uploads and application customization](#uploads-and-application-customization)
- [Deployment and compatibility](#deployment-and-compatibility)
- [Documentation, contribution and license](#documentation-contribution-and-license)

## Quick start

```sh
npm create cellsweb-rpc-api@latest my-api -- --framework=node --yes --pm=npm
cd my-api
npm run typecheck
npm run build
npm test
npm run dev
```

The correct npm initializer name is **cellsweb-rpc-api**, not
create-create-cellsweb-rpc-api. For an exact generator version:

```sh
npx create-cellsweb-rpc-api@1.0.31 my-api --framework=node --yes --pm=npm
```

Once running (port4000 by default), invoke the generated hello function:

```sh
curl http://localhost:4000/rpc \
  -H 'Content-Type: application/json' \
  --data '{"namespace":"public","functionName":"hello","data":{"name":"Ada"}}'
```

Open `/docs` during development to inspect registered functions and middleware.
The generated hello contract is the source of truth for its complete response.
Frontend applications install `@cellsweb/rpc-client` independently.

## Interactive and automated setup

With an interactive terminal, the CLI asks for target directory (if omitted),
package name, package manager and framework. Choose a fresh empty directory;
this is not an in-place migration tool for existing applications.

```sh
npm create cellsweb-rpc-api@latest
# Equivalent executable:
npx create-cellsweb-rpc-api@latest my-api
# pnpm initializer:
pnpm create cellsweb-rpc-api@latest my-api
```

For automation, provide the target directory first and explicit flags:

```sh
npx create-cellsweb-rpc-api@1.0.31 generated-api \
  --framework=fastify --name=example-api --pm=npm --yes --skip-install
cd generated-api
npm install
npm run typecheck
npm run build
npm test
```

| Flag | Purpose |
|---|---|
| `--framework=name`, `--framework name`, `-f name` | Select adapter |
| `--yes`, `-y`, `--non-interactive` | Use defaults without prompts |
| `--skip-install`, `--no-install` | Generate files without installing dependencies |
| `--pm=npm`, `--pm=pnpm`, `--pm=yarn`, `--pm=bun` | Select package manager |
| `--name=package-name`, `--name package-name`, `-n package-name` | Generated package name |

Without a TTY, defaults are used; explicit `--yes` documents automation intent.
The default package manager is pnpm. Use `--pm=npm` if you want npm installation.
The CLI's framework aliases are conveniences; prefer the canonical names below.

## Seven supported adapters

| Flag value | Generated HTTP integration | Runtime used in regression coverage |
|---|---|---|
| `node` | Native node:http | Node 24 |
| `express` | Express request/response handler | Node 24 |
| `fastify` | CRPC Fastify plugin, including multipart stream handoff | Node 24 |
| `ultimate-express` | uWebSockets-backed Express-compatible requests | Node 24 |
| `hono` | Fetch handler through @hono/node-server | Node 24; Bun-hosted integrations tested separately |
| `elysia` | Elysia Fetch plugin | Bun |
| `bun` | Native Bun.serve | Bun |

```sh
npx create-cellsweb-rpc-api@1.0.31 node-api --framework=node --yes --skip-install
npx create-cellsweb-rpc-api@1.0.31 express-api --framework=express --yes --skip-install
npx create-cellsweb-rpc-api@1.0.31 fastify-api --framework=fastify --yes --skip-install
npx create-cellsweb-rpc-api@1.0.31 ultimate-api --framework=ultimate-express --yes --skip-install
npx create-cellsweb-rpc-api@1.0.31 hono-api --framework=hono --yes --skip-install
npx create-cellsweb-rpc-api@1.0.31 elysia-api --framework=elysia --yes --skip-install
npx create-cellsweb-rpc-api@1.0.31 bun-api --framework=bun --yes --skip-install
```

For a Bun application, install/run using Bun after generation:

```sh
cd bun-api
bun install
bun run typecheck
bun run build
bun run dev
```

The CLI detects Bun when the CLI process itself runs under Bun. Use the selected
adapter's supported runtime; Hono/Fetch integration is not a promise that
filesystem discovery works in every Edge host. A framework's theoretical
platform list is different from this project's tested runtime matrix.

## Generated project structure

```text
my-api/
  package.json                 # scripts, core SDK and selected adapter
  tsconfig.json                # strict TypeScript, emitted declarations
  .env.example                 # documented environment defaults
  .env                         # initial copy if absent
  test.ts                      # integration tests
  src/
    server.ts                  # selected adapter and startup
    env.ts                     # dotenv loading, conversion and validation
    functions/public/hello/    # constants, handler, middleware attachments, tests
    middlewares/auth/          # customize credential verification
    middlewares/rateLimit/     # in-memory rate-limiting example
    utils/                     # request logging, storage and application helpers
    test/                      # test context and lifecycle helpers
```

Inspect generated files as application-owned code. The initializer currently
requests **core^1.0.34**; this compatible range includes the documentation-only
1.0.35 patch. It is intentionally unchanged because no new runtime dependency is
required. Generated servers do not depend on rpc-client; your frontend does.

## Functions and middleware

Create a function through the installed project-local core CLI:

```sh
npm run create:function -- --ns catalog --name get --contentType json
npm run create:middleware -- --name tenant --description 'Resolve tenant'
```

A function is co-located under `src/functions/<namespace>/<functionName>/`:

- constants.ts: metadata, content type, input/output schemas and inferred types.
- run.ts: application handler, independent of the HTTP framework.
- middlewares.ts: ordered attachments through `defineMiddlewares`.
- test.ts: focused tests using the application's test setup.

Nested namespaces are supported. Add `--middlewares` to the function generator
when applicable; JSON `--batch` and `--file` specs support repeated generation.
These are **project CLI** flags, distinct from the initializer's flags.

Authentication belongs to middleware. The generated auth function is an editable
stub, not a JWT verifier or authorization guarantee. Verify credentials before
establishing trusted server context; caller JSON cannot bypass middleware.
Register/discover before serving. Middleware execution is sequential; runtime
registration during serving is outside the supported concurrency contract.

The rateLimit example is in-memory. Select a shared store for distributed limits
and tune policy for authenticated identities/proxies. Configure trustProxy
explicitly before trusting forwarded client IPs. Deprecated isPublic is ignored
and is not generated in new functions; it has no documentation/auth meaning.

## Development, build and tests

| Command | Purpose |
|---|---|
| `npm run dev` | TypeScript development server/watch |
| `npm run typecheck` | TypeScript checks without emitting |
| `npm run build` | Compile and resolve emitted import aliases/extensions |
| `npm start` | Run production output |
| `npm test` | Project Vitest tests |
| `npm run test:watch` | Watch tests |
| `npm run test:coverage` | Coverage report |
| `npm run test:audit` | Application test/audit report tooling |

Build before production start. Add regression tests that assert actual handler
results, envelopes, authentication decisions and cleanup, not merely HTTP 200.
The audit command is a development report, not security certification.

## Environment and documentation controls

src/env.ts loads dotenv. Already-exported process variables take precedence over
`.env`; values are converted/validated before templates pass them into CoreRPC.

| Environment | Purpose |
|---|---|
| `NODE_ENV` | development, test or production |
| `API_PORT`, `API_HOST` | Listening address |
| `API_DOCS_ENABLED` | Explicit production docs enablement; parsed boolean |
| `API_REQUEST_TIMEOUT_MS` | Application timeout configuration |
| `MAX_JSON_BODY_BYTES` | JSON intake limit |
| `MAX_MULTIPART_BYTES`, `MAX_UPLOAD_FILE_BYTES` | Multipart total/per-file limits |
| `UPLOAD_TMP_DIR` | Temporary upload location |
| `UPLOAD_MODE`, `UPLOAD_DIR` | Application storage helper mode/directory |

Every adapter template enables docs outside production by default, and requires
parsed API_DOCS_ENABLED=true in production. `false` does not enable production
docs. An explicit application `docs:false` overrides environment defaults.
Parsing accepts trimmed true/false or1/0 (case-insensitive); invalid production
values fall back to disabled. Set docs:false for private development environments
as well. Change the app's `docsEndpoint` for a custom path.

Docs may list every registered function and show schemas, middleware headers and
descriptions. They never read live secret option values. No per-function
hideFromDocs flag exists. Use middleware for RPC authorization and global docs
configuration for documentation exposure.

## Uploads and application customization

Use File/Files in TypeBox input schemas for physical uploads and FormNum/FormBool
where multipart text conversion is intended. The client accepts top-level
File/Blob/native URI assets and direct file arrays; nested file objects are not
supported. Keep routing headers/body consistent and let FormData set its boundary.

Native Node stream adapters use Busboy. Fetch adapters may buffer at the runtime
formData interface. Temp files are cleaned after processing; persist within the
handler to an application-owned unique path when needed. MIME limits do not
sanitize uploaded content; validate content for your use case. Existing server
file-array completion order is not a stable business ordering guarantee.

Customize storage.ts for local/S3 persistence and telemetry helpers for your
monitoring. Optional SDKs in generated applications do not establish production
credentials or configure your infrastructure automatically.

## Deployment and compatibility

Keep .env and credentials out of version control. Install/build in your release
environment, set production configuration, run tests, then start the compiled
entrypoint. Handle process shutdown in your application's host integration.

This is a documentation-only initializer patch. Function discovery, schemas,
middleware order, HTTP 200 application-error envelopes, multipart handling and
server APIs are unchanged. Upgrade the core independently according to your
application's package manager and lockfile policy.

## Documentation, contribution and license

[Getting started](https://cellsweb.github.io/crpc-node/getting-started/) ·
[CLI guide](https://cellsweb.github.io/crpc-node/cli/) ·
[Adapters](https://cellsweb.github.io/crpc-node/adapters/) ·
[Source](https://github.com/CellsWeb/crpc-node/tree/main/packages/create-cellsweb-rpc-api) ·
[Contributing](https://github.com/CellsWeb/crpc-node/blob/main/CONTRIBUTING.md) ·
[Security policy](https://github.com/CellsWeb/crpc-node/security/policy)

MIT ©2026 CellsWeb. See [LICENSE](https://github.com/CellsWeb/crpc-node/blob/main/LICENSE).
