# create-cellsweb-rpc-api

Public release **1.0.30** generates a core`^1.0.34` dependency and requires
Node>=24.0.0. Both packages are available from public npm.

```sh
npm create cellsweb-rpc-api@latest my-api -- --framework=node --yes
# Or use the pinned executable:
npx create-cellsweb-rpc-api@1.0.30 my-api --framework=node --yes
```

Supported framework names are node, bun, elysia, express, fastify, hono and
ultimate-express. Use --yes --skip-install for explicit automation, then install,
typecheck, build and test. Bun 1.3.11 is tested separately for Bun/Elysia execution;
Node 24 LTS is primary. Hono's tested Node host does not imply Edge discovery.

Generated src/env.ts loads dotenv with process exports taking precedence.
Production docs require parsed API_DOCS_ENABLED=true; other environments keep
the development default. Explicit app docs:false overrides it. Auth modules are
customization stubs; supply real verification. Legacy isPublic is not generated.
See repository docs/cli.md, docs/adapters.md and RELEASE.md for exact workflow.
