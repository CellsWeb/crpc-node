# Generated CellsWeb RPC application

Node 24 LTS is primary (engines >=24.0.0). Bun/Elysia templates run under Bun,
tested separately with 1.3.11. Install dependencies, then run:

```sh
npm run typecheck
npm test
npm run build
npm start
```

The generated core requirement is ^1.0.34 and resolves from public npm.
Use ordinary package installation; no local SDK checkout or override is required.

Use npm run dev for Node development. For Bun select Bun execution, for example
`bun run src/server.ts` with the Bun-native template. The local crpc CLI supplies
function/middleware generation, build and tests. Complete templates cover native
Node, Express, Fastify, Hono, Ultimate Express, Bun and Elysia.

src/env.ts loads .env without overriding exported values. API_PORT/API_HOST
default to 4000/0.0.0.0. Docs are enabled outside production; production requires
parsed API_DOCS_ENABLED=true (true/false/1/0, trimmed and case-insensitive).
To disable even in development set the explicit CoreRPC docs:false option.
Disabling docs blocks their pages, not function execution. No visibility flag
exists; deprecated isPublic is ignored and new functions omit it.

Replace the generated auth stub with real credential verification. Middleware
owns authentication/authorization; remote clients forward headers, not trusted
context or a middleware-skip switch. Function input/output schemas remain active.

Use File/Files for uploads. Node UploadedFile exposes path, filename, mimeType,
byteLength and stream/buffer/blob methods. Persist into application-owned storage
while the handler runs; temporary uploads are cleaned afterward. Use configured
limits and top-level/direct-array file fields. Fetch multipart may buffer at the
runtime boundary; no zero-memory guarantee is implied.
