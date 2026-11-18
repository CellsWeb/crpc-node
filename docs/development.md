# Node contributor setup

The [contribution guide](contributing.md) is the canonical onboarding and PR policy.
This page explains how the tools and example applications fit together.

## Tested toolchain

| Tool | Validated version / role |
|---|---|
| Node | 24.15.0 primary; exact24.0.0 floor tested; package engines>=24.0.0 |
| pnpm | 11.0.8; workspace install/build/test driver |
| TypeScript | 7.0.2 from pnpm-lock.yaml; do not replace it with a global compiler |
| Bun | 1.3.11 for Bun/Elysia and native CLI checks |
| Go | 1.27.4 for cross-runtime/IPC work, in its separate repository |
| Documentation | Python 3.14.7; MkDocs 1.6.1, Material 9.8.1, PyMdown 13.1 validated |

```sh
npm install --global pnpm@11.0.8
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm --filter @cellsweb/rpc-core test:types
```

Run these from a clone/fork, not a generated consumer application. The root is
private; packages are separate publishable workspaces. Build excludes example,
while typecheck/tests include it. packageManager is not currently pinned in the
manifest; the tested pnpm version avoids unsupported assumptions about pnpm 9.

Keep the source checkout pnpm-managed. Running pnpm against npm-installed
node_modules can trigger a dependency migration/reinstall. The source workspace
already explicitly permits the required esbuild build script; review dependency
build approvals rather than blanket-approving arbitrary scripts. Generated users'
normal npm installation is a separate workflow.

## Edit and run an application

example is the reference app. After building the core, run `pnpm --dir example dev`.
Its functions/middlewares import workspace packages. A real generated project
instead installs the public SDK. To evaluate local SDK changes in that project,
pack the local SDK and select it explicitly in a disposable manifest; do not
commit that override or claim it was a registry-only install.

Discoverable functions use constants.ts/run.ts/middlewares.ts; middleware uses
constants.ts/run.ts. Use the project-local scripts described in the contribution
guide. Read the generated tests and auth customization before deploying anything.
Avoid changing the example's routes incidentally while fixing core behavior.

## Documentation workflow

```sh
python3 -m venv /tmp/crpc-docs-venv
/tmp/crpc-docs-venv/bin/python -m pip install mkdocs-material
/tmp/crpc-docs-venv/bin/mkdocs serve
/tmp/crpc-docs-venv/bin/mkdocs build --strict --site-dir /tmp/crpc-node-site
```

Use the same MkDocs/Material/PyMdown configuration as the existing docs workflow;
this task does not introduce a new CI job or dependency declaration. The tested
versions above describe validation, not an enforced Python lock. Mermaid uses
the configured SuperFences formatter and Material's runtime. A strict build checks
Markdown/configuration; also open diagram pages to confirm SVG rendering, validate
links and compile marked examples. Root community policies are included by
PyMdown snippets, so run MkDocs from the repository root.

For a targeted fix, [choose a test](internals/testing.md) first, then follow the
[source map](internals/index.md). Report unavailable runtimes/platform checks
explicitly. Keep generated dist, uploads, node_modules and local agent edits out
of the PR. The sibling Go setup is independent:
[Go development](https://cellsweb.github.io/crpc-go/development/).
