# Node tests and safe subsystem changes

A test should reproduce behavior at the layer that owns it. Parser mocks alone
cannot establish socket behavior; source imports alone cannot establish packed
exports; HTTP200 alone cannot establish a correct RPC or documentation response.

## Source-to-test map

| Change | Tests / real path | What to assert |
|---|---|---|
| Registry/pipeline/errors | [packages/rpc-core/src/core-rpc.test.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/src/core-rpc.test.ts), [packages/rpc-core/src/framework-integration.test.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/src/framework-integration.test.ts) | Imported functions, middleware order, missing middleware, headers/input/output, execute/workers |
| JSON limits/auth/headers | [packages/rpc-core/src/security-hardening.test.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/src/security-hardening.test.ts) | Real HTTP oversized/slow/aborted bodies, error envelope, handler non-execution, cleanup/listeners |
| Custom schema/nullable/file unions | [packages/rpc-core/src/union-validation.test.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/src/union-validation.test.ts) | Positive/negative shapes, optional/null/defaults/transforms, physical file identity/limits |
| Native multipart lifecycle | [packages/rpc-core/src/multipart-lifecycle.test.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/src/multipart-lifecycle.test.ts) | complete/readableEnded/end/close/aborted distinctions, temp cleanup |
| Fetch body semantics | [packages/rpc-core/src/web-standards.test.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/src/web-standards.test.ts) | Web Request/formData limits, routing/auth-before-write, files and JSON |
| Documentation | [packages/rpc-core/src/fetch-docs.test.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/src/fetch-docs.test.ts), [packages/rpc-core/src/docs-parity.test.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/src/docs-parity.test.ts) | Actual detail/schema HTML, URLs/custom paths, disabled docs, ignored metadata, secret projection |
| Client transport/form data | [packages/rpc-client/src/client.test.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-client/src/client.test.ts), [packages/rpc-client/src/multipart.test.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-client/src/multipart.test.ts) | JSON shapes, default merging, RPC errors, routing fields, file arrays/RN/nesting rejection |
| Fastify integration | [packages/create-cellsweb-rpc-api/test/fastify-multipart.test.mjs](https://github.com/CellsWeb/crpc-node/blob/main/packages/create-cellsweb-rpc-api/test/fastify-multipart.test.mjs) | No415 before CRPC, existing parser, raw stream, JSON/route non-regression |
| Seven generated projects | [packages/create-cellsweb-rpc-api/test/server-types.test.mjs](https://github.com/CellsWeb/crpc-node/blob/main/packages/create-cellsweb-rpc-api/test/server-types.test.mjs), [packages/create-cellsweb-rpc-api/test/server-docs.test.mjs](https://github.com/CellsWeb/crpc-node/blob/main/packages/create-cellsweb-rpc-api/test/server-docs.test.mjs), [packages/create-cellsweb-rpc-api/test/multipart-adapters.test.mjs](https://github.com/CellsWeb/crpc-node/blob/main/packages/create-cellsweb-rpc-api/test/multipart-adapters.test.mjs) | Actual tsc/build/HTTP and environment modes, not only text/200 |
| Published declaration graph | [packages/rpc-core/test/consumer-types.mts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/test/consumer-types.mts), [packages/rpc-core/test/consumer-types.cts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/test/consumer-types.cts) | Strict ESM/CJS helper composition, inferred input, legacy metadata/default import |

The generated-project support files are
[packages/create-cellsweb-rpc-api/test/support/generated-project.mjs](https://github.com/CellsWeb/crpc-node/blob/main/packages/create-cellsweb-rpc-api/test/support/generated-project.mjs),
adapter-probe.mjs, docs-probe.mjs and multipart-probe.mjs in the same directory.
Workspace dependency links make normal regression runs practical; they are not a
substitute for separate registry-only release validation.

## Executed commands versus claims

```sh
pnpm --filter @cellsweb/rpc-core exec vitest run src/union-validation.test.ts
pnpm --filter @cellsweb/rpc-client test
pnpm --filter create-cellsweb-rpc-api test
pnpm build
pnpm typecheck
pnpm test
pnpm --filter @cellsweb/rpc-core test:types
```

The full Node release baseline reported364 runner entries (parent groups count in
the Node test runner), not364 distinct Vitest leaf tests. Prefer fresh command
results to stale counts. All seven adapters require real dependencies and Bun;
state missing tooling instead of silently skipping. test:types needs registry
access and runs an actual npm pack/install with fresh consumer dependencies.

## Red/green workflow

1. Pin baseline SHA and inspect the real owning function/adapter.
2. Add a failure that captures user-visible behavior, including call counts and
   resource ownership. Run it before the fix and retain the failure output.
3. Make the smallest implementation change for that root cause, respecting the
   [protocol boundaries](protocol.md). Do not weaken validation/auth/limits.
4. Run the focused regression then relevant existing suites. Broaden to full
   build/typecheck/tests for execution, parser, generator or export changes.
5. For shared behavior, use equivalent inputs in Go's checked-in HTTP JSON fixture
   set and relevant transport suites. The review kit's parity driver is not a
   distributed contributor command; provide a reproducible harness/results.

Docs-only edits require strict site/link/diagram checks and meaningful executable
examples, not synthetic tests mirroring prose. Do not refactor a pipeline, change
XHR selection, add CI or change a frame limit as a side effect of documenting it.
