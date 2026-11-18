# Node CLI, scaffolder and declaration build

The initializer and runtime CLI are different responsibilities even though the
released packages both expose a crpc binary. These internals describe the current
layout; they do not remove or rename either executable.

## Project initializer

[packages/create-cellsweb-rpc-api/bin/create.js](https://github.com/CellsWeb/crpc-node/blob/main/packages/create-cellsweb-rpc-api/bin/create.js) parses interactive
or flag-driven project/framework choices, copies template content, selects a
server from templates/servers, writes the project manifest/tsconfig/scripts and
optionally installs dependencies. The generated core range is ^1.0.34 and the
Node engine range is >=24.0.0. Published user setup requires no local SDK link.

The template tree owns env parsing, sample functions/middleware, application
telemetry/storage helpers, tests and Vitest configuration. Server variants own
framework mounting and static-file response handling. These are application
sources, not additional core RPC protocol endpoints. A template test must build
and run the actual generated project; a matching string in a template alone
cannot detect TypeScript export inference or BodyInit integration errors.

Application utilities live in
[template/src/utils/storage.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/create-cellsweb-rpc-api/template/src/utils/storage.ts),
[imageHandler.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/create-cellsweb-rpc-api/template/src/utils/imageHandler.ts)
and [telemetry.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/create-cellsweb-rpc-api/template/src/telemetry.ts).
They own persistence/URL helpers, image-field replacement and application metrics
integration. Core owns request-temp intake, not the app's permanent storage or
third-party telemetry lifecycle. Do not infer a real cloud provider was exercised
from an SDK build; configure and test that integration separately.

## Runtime crpc command

[packages/rpc-core/bin/crpc.js](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/bin/crpc.js) dispatches dev/build/start/test and
function/middleware generation. Dev resolves an entry and chooses a Node TS runner
or native Bun based on the CLI runtime; build invokes tsc and tsc-alias with
extension rewriting; start runs emitted production JavaScript. The generated
app supplies its build/test tools. The same-named initializer package CLI exists
in the current release; use the app-local core command rather than global bin
ordering assumptions.

Function/middleware generator modules are under the same bin directory. They
support the documented flags and batch/file inputs. Programmatic scaffold helpers
live in [packages/rpc-core/src/scaffold.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/src/scaffold.ts); do not assume every CLI
flag or source-generation path is identical to that API. Add tests to the path
actually changed. New functions should not generate ignored isPublic metadata.

## Environment and documentation defaults

Generated src/env.ts imports dotenv without replacing existing exports and parses
boolean/numeric values. Every server applies the established docs expression:
outside production enabled; in production require parsed API_DOCS_ENABLED=true.
An explicit application docs:false overrides this because it is application code.
CoreRPC itself does not load dotenv; raw production environment defaults require
the exact string true. Keep these existing precedence differences documented,
not silently harmonized in a generator cleanup. Go's exported DOCS_ENABLED/
DOCS_PATH setup is a different API; see its contributor guide.

## Build/pack boundary

[packages/rpc-core/package.json](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/package.json) exposes one CommonJS JavaScript
entry and module-mode-specific TypeScript declarations. tsc generates .d.ts;
emit-import-types.mjs generates the .d.mts graph. test-types.mjs installs an actual
pack into a strict clean consumer. The client has separate base/React exports;
its package file filter excludes emitted test artifacts. The scaffolder must
retain its intended template tests, not accidentally exclude all test.ts files.

To change CLI or package documentation, test --help/actual generation outside the
monorepo, typecheck/build/run and check the packed file list/bins. Never change
package versions merely to validate docs. Use [testing](testing.md) and
[release engineering](releasing.md) before proposing a distribution change.
