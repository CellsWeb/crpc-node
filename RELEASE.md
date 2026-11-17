# Coordinated release plan — awaiting approval

No package, tag or branch integration is authorized by this file. Gemini must
verify the final candidate commits before the author approves integration and
publication. Version numbers below are prepared candidates, not evidence that
an artifact is already available.

| Artifact | Current public version checked during preparation | Prepared next version |
|---|---|---|
| @cellsweb/rpc-core | 1.0.33 | 1.0.34 |
| @cellsweb/rpc-client | 1.0.23 | 1.0.24 |
| create-cellsweb-rpc-api | 1.0.29 | 1.0.30 |
| github.com/CellsWeb/crpc-go and crpc-go CLI | v1.0.0 | v1.0.1 |

Generated Node apps require `@cellsweb/rpc-core:^1.0.34` and Node >=24.0.0.
That requirement becomes registry-resolvable only after core1.0.34 is published.
Clean candidate tests select the actual local SDK tarball explicitly; they do
not substitute the older public core while claiming candidate coverage.

Node 24 LTS is primary. The engine floor24.0.0 is tested directly; this is a
documented runtime policy change from earlier guides. Older Node versions can
work without shims but are not declared supported. Bun1.3.11 is tested separately.
Review the versioning impact of this runtime policy before final approval.

## Local candidate installation and smoke tests

From the Node repository, build and pack into an empty disposable directory:

```sh
pnpm build
pnpm typecheck
pnpm test
mkdir -p /tmp/crpc-release-artifacts
npm pack ./packages/rpc-core --pack-destination /tmp/crpc-release-artifacts
npm pack ./packages/rpc-client --pack-destination /tmp/crpc-release-artifacts
npm pack ./packages/create-cellsweb-rpc-api --pack-destination /tmp/crpc-release-artifacts
```

In a new directory, install the local core/client/scaffolder tarballs with npm.
Invoke the installed `create-cellsweb-rpc-api` binary with `--framework=<adapter>
--yes --skip-install`. For this unpublished candidate, set only that disposable
app's SDK dependency to the local core tarball before installing. Preserve the
generated `^1.0.34` minimum in the actual published template.

Run `npm run typecheck`, `npm run build`, `npm test`, then real HTTP RPC/docs and
multipart probes. Cover all seven adapters: Node, Bun, Elysia, Express, Fastify,
Hono and Ultimate Express. Test successful, schema-invalid and unauthorized
requests, file arrays/empty/binary uploads, malformed/oversized/interrupted
requests, cleanup, and production docs disabled/enabled. Test installed exports
with CommonJS and ESM, React from `/react`, declarations and generated CLI bins.
Use Node24.0.0 and the primary installed Node24 runtime; run Bun adapters on Bun.

For Go candidate use, build this checkout's CLI, generate an app, and explicitly
select the SDK checkout using `go work init . /absolute/path/to/rpc-go`. The
source CLI's real v1.0.0 fallback is older and does not contain the candidate
hardening. Do not change that verified fallback to an unpublished version.

Required Go gates include:

```sh
go build ./...
CRPC_STANDALONE_INTEGRATION=1 go test -count=1 ./...
CRPC_STANDALONE_INTEGRATION=1 CRPC_SCAFFOLD_RACE=1 go test -race -count=1 ./...
go vet ./...
# From example-node:
npm run typecheck
CRPC_IPC_TEST_RACE=1 npm test
```

Build both MkDocs sites with `mkdocs build --strict` into external directories.
Review [CHANGELOG.md](CHANGELOG.md), the Go changelog and public examples; test
both normal RPCs and disabled docs/detail/schema paths. A documentation build
does not prove example code compiles; compile marked examples separately.

## Integration after independent verification and explicit approval

The expected pre-integration main tips are Node
`7b2a41cb8dd76e0a3843733c11185ab9b62a6af2` and Go
`15ab708a7be119fa5df2c2ebe474d5dd98256547`. Re-read remote refs before acting.
Use clean main worktrees to preserve the original agent-file modifications.

Proposed commands, **not executed**:

```sh
git -C /Users/minhazurrahman/NodeJs/Packages/cellsweb-rpc fetch origin
git -C /Users/minhazurrahman/NodeJs/Packages/cellsweb-rpc merge-base --is-ancestor origin/main codex/rc-node-unions-runtime-docs
git -C /Users/minhazurrahman/NodeJs/Packages/cellsweb-rpc worktree add /tmp/crpc-node-release-main main
git -C /tmp/crpc-node-release-main merge --ff-only codex/rc-node-unions-runtime-docs

git -C /Users/minhazurrahman/GoLang/rpc-go fetch origin
git -C /Users/minhazurrahman/GoLang/rpc-go merge-base --is-ancestor origin/main codex/rc-go-public-docs-release
git -C /Users/minhazurrahman/GoLang/rpc-go worktree add /tmp/crpc-go-release-main main
git -C /tmp/crpc-go-release-main merge --ff-only codex/rc-go-public-docs-release
```

Confirm local main equals the freshly fetched main and the candidate SHA equals
the author-approved verified SHA before either merge. Stop on changed history;
do not force or cherry-pick away verified fixes. The shared coordination handoff
records the final exact commit SHAs; this file cannot embed its own commit SHA.

## Publication sequence — separate approval required

1. Recheck version availability, clean Git status, verified SHA and exact packed
   contents/checksums. Never overwrite or retarget an existing release.
2. Publish the validated core1.0.34 artifact first, then client1.0.24, then
   scaffolder1.0.30, whose generated SDK range now resolves to hardened core.
   Scoped packages retain public access. Avoid the unchecked root publish-all
   shortcut. Confirm registry versions/exports before promoting defaults.
3. Tag the approved Go commit with a **new root-module tag v1.0.1**. The module
   path stays `github.com/CellsWeb/crpc-go`; the CLI display version is1.0.1.
   Never move v1.0.0 or describe it as hardened. Its older source-build fallback
   remains intentional; a versioned v1.0.1 CLI selects SDKv1.0.1 automatically.
4. Once the new Go tag is publicly available, check the module proxy and install
   `github.com/CellsWeb/crpc-go/cmd/crpc-go@v1.0.1` into a clean GOBIN. Generate a
   fresh app with `GOWORK=off`, confirm SDKv1.0.1/no replacement, resolve/build/run
   it, and repeat HTTP/docs/auth/schema/IPC smoke tests. This exact public
   installation is not testable before publication and is a release gate.
5. Repeat normal registry-only Node scaffolding without file overrides. Confirm
   core>=1.0.34 and all seven builds/runtime checks, then publish reviewed docs.

If prerelease distribution is preferred, first choose explicit `-rc.N` package
versions and a matching generated SDK range, repack/retest them, and use a
non-default npm dist-tag. A stable caret does not select an unrelated prerelease.
Do not rename a tested stable tarball into a prerelease and claim it is identical.

All actual merge, push, tagging, registry publication and docs deployment steps
remain outside this implementation assignment.
