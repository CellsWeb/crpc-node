# Getting started

## Released versions and prerequisites

Public versions: **@cellsweb/rpc-core@1.0.34**, **@cellsweb/rpc-client@1.0.24**,
**create-cellsweb-rpc-api@1.0.30**. Node 24 LTS is primary; the declared floor is
Node 24.0.0. Bun 1.3.11 is tested separately for Bun/Elysia execution.

## Scaffold a project

```sh
npm create cellsweb-rpc-api@latest my-api -- --framework=node --yes
cd my-api
npm run typecheck
npm test
npm run dev
```

For an exact initializer version use
`npx create-cellsweb-rpc-api@1.0.30 my-api --framework=node --yes`.
Choose `bun|elysia|express|fastify|hono|node|ultimate-express` as framework.
For automation add `--skip-install`, then install the generated manifest yourself.
Generated applications require core`^1.0.34`, resolved from public npm; no local
SDK tarball or checkout is necessary. For Bun, use the selected Bun template and
run its CLI under Bun when native Bun execution is wanted.

For an existing application, install only the package needed:

```sh
npm install @cellsweb/rpc-core@1.0.34
# In a client project:
npm install @cellsweb/rpc-client@1.0.24
```

The scaffold contains src/server.ts, src/env.ts, src/functions, src/middlewares,
utilities, schemas and sample tests. Replace the sample authentication logic with
your application's credential verification before relying on it.

```sh
curl http://localhost:4000/rpc -H 'Content-Type: application/json' \
  -d '{"namespace":"public","functionName":"hello","data":{"name":"Alice"}}'
```

## Configuration

The generated `src/env.ts` loads `.env` through dotenv; exported process values
win. It parses numeric settings and booleans before passing them to CoreRPC.
The default host/port are 0.0.0.0:4000. `API_PORT`, `API_HOST`, body/file limits,
upload settings and telemetry are documented in the generated env module.

Generated docs are enabled outside production. In production they require parsed
`API_DOCS_ENABLED=true` (trimmed/case-insensitive true/false/1/0; invalid falls
back to false). Outside production the template deliberately keeps docs enabled
even if this env flag is false; set application `docs:false` to disable them.

Direct `new CoreRPC(...)` reads process env, not dotenv. Explicit `docs`,
`docsEndpoint`, `rpcEndpoint`, host/port options win. Raw-core production docs
require exact string `API_DOCS_ENABLED=true`; outside production default is true.
`API_RPC_ENDPOINT`, `API_DOCS_ENDPOINT`, `API_HEALTH_ENDPOINT` provide defaults.
See [global docs controls](interactive-docs.md) for disabled routes and privacy.

Build for deployment with `npm run build`, then `npm start`. The CLI start
command sets NODE_ENV=production. Review docs exposure explicitly. All registered
functions execute under the same middleware regardless of deprecated isPublic.
