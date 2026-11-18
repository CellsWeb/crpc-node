# Release engineering

## Published release

The coordinated public releases are @cellsweb/rpc-core@1.0.34,
@cellsweb/rpc-client@1.0.24, create-cellsweb-rpc-api@1.0.30 and
Go github.com/CellsWeb/crpc-go@v1.0.1. See [CHANGELOG.md](CHANGELOG.md) and
[installation](docs/getting-started.md). The Node release source is
320e65997db9c14cec8ab2ef15d745aab3894819; Go is
c4b7966e4cc5dda0fdd6728f57f82b66fd2afe4b. Existing tags are immutable.

The actual public CLI and npm initializer were tested in independent projects:

```sh
npm create cellsweb-rpc-api@latest my-api -- --framework=node --yes
# A pinned initializer is also available:
npx create-cellsweb-rpc-api@1.0.30 my-api --framework=node --yes
```

Go's versioned installed CLI generates a matching SDK dependency:

```sh
go install github.com/CellsWeb/crpc-go/cmd/crpc-go@v1.0.1
crpc-go init my-go-api
cd my-go-api
go mod tidy
go build ./...
go test ./...
```

Source/VCS-built Go CLIs still select the older v1.0.0 fallback. Use an explicit
Go workspace when intentionally selecting a local SDK checkout; the version
printed by an arbitrary source binary does not pin its dependency.

## Checklist for future releases

This is maintainer guidance, not permission to publish or change versions.

1. Scope and review the change, including cross-runtime protocol effects. Use
   focused commits and feature branches. Require reproducible red/green evidence
   for bug fixes, relevant full suites and independent review.
2. Preserve local unrelated files; use clean release worktrees. Fetch current
   refs and confirm an approved integration is a fast-forward. Never force a
   verified branch or replace a published tag. Check branch protections.
3. Check actual public versions, approved package/module metadata, engines,
   dependency ranges and entrypoints. An npm version being unused is not a
   reservation. Choose new versions deliberately; never retry a failed publish
   with an invented version.
4. Build, typecheck, test and inspect npm pack --dry-run and actual tarballs for
   every publishable package. Check exports/declarations/bins and accidental
   files. For local unreleased tests, explicitly select local tarballs only in
   disposable application manifests; never confuse that with a public install.
5. After explicit release approval, publish core before a scaffolder that
   requires its new SDK range. Publish the client with its own approved version.
   Use the official registry/public access, browser authentication when required,
   and one publishing process at a time. Never put credentials in reports.
6. For Go, use a new root-module tag at the approved commit. The installed CLI
   and generated SDK must resolve the same released module. Verify the public
   proxy and checksum database; do not hide propagation failures with older code.
7. Repeat registry-only npm/Go installations with fresh caches, no local SDK
   links/replacements/workspaces. Exercise all seven adapters, Bun, HTTP error
   envelopes, docs disabled/detail routes, multipart limits and cleanup, and IPC.
8. Update published-version prose and changelogs after real publication checks.
   Main pushes changing docs trigger the existing GitHub Pages workflow; review
   deployment timing together with the source push. Do not silently publish docs
   describing versions that are not available.

## Validation commands

```sh
pnpm build
pnpm typecheck
pnpm test
pnpm --filter @cellsweb/rpc-core test:types
```

For Go, run build/tests/vet/race, the explicitly enabled standalone generated-app
suite and example-node IPC checks. Strict MkDocs builds and executable guide
examples are separate gates; a clean site build alone does not compile snippets.
Full contributor test maps and source-development setup belong in the contributor
guides. A prerelease requires explicit prerelease versions/ranges/dist-tags and
fresh artifacts; do not rename tested stable tarballs or move old tags.
