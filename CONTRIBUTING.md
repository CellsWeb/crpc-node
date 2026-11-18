# Contributing to CellsWeb RPC Node

Welcome. Small corrections, reproducible bug reports, tests and focused features
are useful contributions. Read the [Code of Conduct](https://github.com/CellsWeb/crpc-node/blob/main/CODE_OF_CONDUCT.md)
and [security policy](https://github.com/CellsWeb/crpc-node/blob/main/SECURITY.md).
Security-sensitive reports must be private. See the MIT LICENSE before including
third-party material.

## Node development setup

Validated toolchain: Node 24.15.0 (declared/tested floor24.0.0), pnpm 11.0.8,
TypeScript 7.0.2 from the lockfile and Bun 1.3.11 for Bun/Elysia. Go 1.27.4 is needed
when reproducing Go interoperability. Full adapter checks were validated on
macOSarm64; report your OS and any platform limitations explicitly.

```sh
git clone https://github.com/CellsWeb/crpc-node.git
cd crpc-node
npm install --global pnpm@11.0.8
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm --filter @cellsweb/rpc-core test:types
```

Use a fork for submission and a focused branch such as docs/request-lifecycle or
fix/multipart-boundary. Existing local edits should stay intact; a separate Git
worktree is useful when reproducing a pinned baseline. The repo does not pin a
packageManager field; use the documented tested pnpm rather than assuming any
older pnpm can read current workspace settings.

## Node repository map and conventions

- packages/rpc-core: CoreRPC, registry, pipeline, request parsers, files, workers,
  renderer and the runtime crpc CLI. Public exports are in src/index.ts.
- packages/rpc-client: request/envelope handling, multipart serialization and
  optional React entrypoint. Keep browser/RN behavior distinct from Node engines.
- packages/create-cellsweb-rpc-api: initializer, template tree and seven servers.
- example: reference application and application-level tests; benchmarks: workloads,
  not a production performance guarantee. docs/ and root mkdocs.yml define the docs site.

Follow the surrounding TypeScript style and strict compiler settings. Preserve
TSchema/Static relationships and public ESM/CommonJS declaration identities.
Avoid any/ts-ignore merely to make tests compile. Keep handlers transport-neutral;
only multipart intake may apply transport-specific schema-directed coercion.

## Create a Node function or middleware

In the reference/generated application, the project-local core CLI is available:

```sh
cd example
pnpm create:function -- --ns catalog --name get --contentType json
pnpm create:middleware -- --name tenantResolver --description 'Resolve tenant'
```

Review generated constants.ts, run.ts, middlewares.ts and tests. Functions live
under `src/functions/<namespace>/<function>`; middleware under `src/middlewares/<name>`.
Use defineMiddlewares attachments explicitly and implement real verification.
Changes to generators require generated-project tests, not just template searches.
Scaffold into a disposable app when experimenting instead of committing demo routes.

## Test and regression workflow

For a bug, pin a baseline, add a behavioral test and record its failing command
before fixing implementation. Assert returned data/envelopes and forbidden handler
execution, not just HTTP200. Include interruption/cleanup and limit cases for I/O.
Focused examples from the repository root:

```sh
pnpm --filter @cellsweb/rpc-core exec vitest run src/union-validation.test.ts
pnpm --filter @cellsweb/rpc-core exec vitest run src/docs-parity.test.ts
pnpm --filter @cellsweb/rpc-client test
pnpm --filter create-cellsweb-rpc-api test
```

Run build/typecheck/full tests for runtime or generator changes. test:types is an
explicit clean npm-pack/install integration check and requires registry access.
The scaffolder suite executes real seven-adapter builds and HTTP/multipart probes;
Bun and the supported native adapter dependencies must be available. Report skips
or unavailable tooling; do not turn an omitted suite into a claimed pass.

## Changes involving both runtimes

Use semantic parity, not identical implementation. Read the sibling
[Go contributor guide](https://github.com/CellsWeb/crpc-go/blob/main/CONTRIBUTING.md).
Propose protocol/default/public-API changes before implementation; identify the
migration/version implications. Attach equivalent logical fixtures and actual
results for Node and Go. Go's checked-in pkg/rpc/testdata/http-json-shapes.json is
a useful fixture set, with HTTP tests in that package and Node union regressions
in rpc-core. There is no checked-in one-command cross-repository parity runner;
do not require a private review-kit path from external contributors.

Preserve these compatibility boundaries unless explicitly reviewed/versioned:

- One configurable RPC endpoint with {namespace,functionName,data}. Arbitrary
  JSON data shapes survive; omitted HTTP data defaults to {}, explicit null stays
  null for schema validation. Do not silently coerce ordinary JSON inputs.
- Successfully handled application errors use HTTP200 by default. Opt-in status
  mapping and transport/framework errors are distinct; not every malformed body
  automatically produces HTTP400. Preserve success/error envelopes and SDK parsing.
- Middleware owns authentication/authorization. Remote callers cannot skip it or
  inject trusted state. Missing configured middleware fails closed.
- Multipart routing headers come as a pair and agree with required body routing.
  Headerless fallback puts routing fields before files. No application-owned
  upload files before required authorization, and no cleanup/size-limit weakening.
- Client files are top-level fields/direct arrays; nested file objects require a
  deliberate versioned design. Native Node streams, Fetch form parsing and Go
  transport buffering have different memory boundaries; do not promise zero RAM.
- Node discovery and Go registration are intentionally different. isPublic/IsPublic
  remain deprecated/ignored compatibility fields; no replacement visibility flag.
- IPC request IDs/framing remain compatible; never replay a failed call implicitly.
  Unix framing limits do not apply automatically to stdio.

## Pull requests and review

Open an issue/discussion first for a substantial architectural/API change. Keep
one root cause per fix and include problem, before/after behavior, affected paths,
compatibility and limitations. Conventional-style subjects such as fix:, docs:
and test: help scanning; match existing style without rewriting unrelated files.

Use the PR template. Provide exact executed commands/outcomes, red/green evidence
for bugs and both-runtime results where applicable. Docs-only PRs should run both
strict MkDocs builds when shared content changes, validate links, render diagrams
and compile meaningful examples; unnecessary implementation-mirroring tests are
not required. Include screenshots for documentation UI changes. State untested
scenarios/skips honestly. Never commit secrets, generated upload files, dist,
node_modules, local workspaces or unrelated agent changes.

A maintainer reviews scope, protocol/API impact, tests, resource cleanup and docs
before merge. Do not merge/publish/tag as part of an ordinary contribution. Release
changes require separate approval and public-install verification. New public API
fields/options and defaults require explicit compatibility review.

The [contributor documentation](https://cellsweb.github.io/crpc-node/internals/)
contains source maps, request lifecycle, subsystem test maps and release guidance.
