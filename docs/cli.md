# CLI

The scaffolder creates a project; `@cellsweb/rpc-core` supplies its runtime `crpc`
binary. Both packages expose that bin name, so use the project-local core CLI for
development/builds rather than relying on global install ordering.

After the candidate is actually published:

```sh
npx create-cellsweb-rpc-api@1.0.30 my-api --framework=fastify --yes
cd my-api
npm run create:function -- --ns catalog --name get --contentType json
npm run create:middleware -- --name tenantResolver --description 'Resolve tenant'
npm run typecheck
npm run build
npm start
```

For local unpublished candidate usage, install tarballs as described in the
repository RELEASE.md. `--skip-install` leaves dependency installation to you.

`crpc dev [entry]` runs a TS watcher; `crpc build` runs tsc then tsc-alias with
emitted-extension resolution; `crpc start [entry]` executes production JS. The
generated project's devDependencies supply those tools. Bun execution is selected
when the CLI itself runs under Bun; preserve the selected template/runtime.

Function generation also supports JSON batch specs (`--batch`/`--file`). Node's
function CLI accepts `--middlewares`; Go's CLI does not share every flag—attach
Go middleware in the generated declaration file. Check each tool's own usage.
`crpc test`, `test:watch`, `test:coverage`, `test:audit` invoke configured Vitest
commands; the audit command is a test-report convenience, not security certification.
