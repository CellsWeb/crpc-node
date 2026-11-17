# Getting started

## Release status

Prepared, unpublished candidate versions: `@cellsweb/rpc-core@1.0.34`,
`@cellsweb/rpc-client@1.0.24`, `create-cellsweb-rpc-api@1.0.30`.
Public latest checked during preparation was 1.0.33/1.0.23/1.0.29 respectively.
It predates this candidate. For local validation use the repository's RELEASE.md
tarball workflow; do not expect an unpublished version to resolve from npm.

Node 24 LTS is primary. All public packages/generated apps declare Node >=24.0.0.
Bun 1.3.11 is tested separately for Bun/Elysia execution. Older Node may work, but
is outside this declared range; no older-runtime shim is required or supplied.

## Scaffold after publication

```sh
npx create-cellsweb-rpc-api@1.0.30 my-api --framework=node
cd my-api
npm run typecheck
npm test
npm run dev
```

Use `--framework=bun|elysia|express|fastify|hono|node|ultimate-express`.
For automation add `--yes --skip-install`, then install the generated manifest
explicitly. Generated projects require core`^1.0.34`; publish core before the
new scaffolder. For Bun use `bun run` with the selected Bun template; tests also
exercise the full generated project under its supported runtime.

The project contains `src/server.ts`, `src/env.ts`, `src/functions`,
`src/middlewares`, utilities, schemas and sample tests. Replace the sample auth
stub with your application's credential verification before relying on it.

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
