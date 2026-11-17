# create-cellsweb-rpc-api

Prepared candidate 1.0.30, not published by this work. Public 1.0.29 is older.
The candidate generates core^1.0.34 and Node >=24.0.0; publish that core before
publishing this scaffolder. Test unpublished candidates with local packed SDK
dependencies rather than resolving the older public SDK silently.

After publication: `npx create-cellsweb-rpc-api@1.0.30 my-api --framework=node`.
Supported framework names are node, bun, elysia, express, fastify, hono and
ultimate-express. Use --yes --skip-install for explicit automation, then install,
typecheck, build and test. Bun 1.3.11 is tested separately for Bun/Elysia execution;
Node 24 LTS is primary. Hono's tested Node host does not imply Edge discovery.

Generated src/env.ts loads dotenv with process exports taking precedence.
Production docs require parsed API_DOCS_ENABLED=true; other environments keep
the development default. Explicit app docs:false overrides it. Auth modules are
customization stubs; supply real verification. Legacy isPublic is not generated.
See repository docs/cli.md, docs/adapters.md and RELEASE.md for exact workflow.
