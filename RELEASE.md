# Release engineering

## Documentation-only patch line

The documentation restoration uses @cellsweb/rpc-core1.0.35,
@cellsweb/rpc-client1.0.26 and create-cellsweb-rpc-api1.0.31. Their runtime code,
exports and dependencies are unchanged from core1.0.34/client1.0.25/scaffolder1.0.30.
Complete package READMEs and original branding are restored. Generated projects
still require core^1.0.34, which accepts the new core patch; no template dependency
change is needed. Publish only inspected exact tarballs after validation and approval.

Go remains **v1.0.2**. GitHub/MkDocs corrections do not require a new module tag.
Never recreate or move v1.0.2 for a documentation-site update.

## Published runtime history

Core1.0.34 and scaffolder1.0.30 include the verified hardening, adapter and docs
control fixes. Client1.0.25 fixes browser multipart custom fetch while retaining
native FormData/XHR. Go v1.0.2 includes bounded2,097,152-byte stdio lines; Unix
framing, lifecycle and error semantics remain as documented.

Those versions are already public. Earlier wording that called client1.0.25 or
Go v1.0.2 unpublished described preparation, not the current distribution state.
The source heads are Node82d126735ecf0c5c53008b3e2f1213bb4b824031 and
Go490b39cb381a0b7ca6da5bd3a7a42da694dc8e2b. The earlier client1.0.24/Go v1.0.1
releases remain available for migration history, as does historical Go v1.0.0.

```sh
npm create cellsweb-rpc-api@latest my-api -- --framework=node --yes --pm=npm
# Exact documentation-refresh initializer:
npx create-cellsweb-rpc-api@1.0.31 my-api --framework=node --yes --pm=npm
```

```sh
go install github.com/CellsWeb/crpc-go/cmd/crpc-go@v1.0.2
crpc-go init my-go-api
cd my-go-api
go mod tidy
go build ./...
go test ./...
```

A versioned installed Go CLI selects its matching SDKv1.0.2. Source/VCS builds
retain the older v1.0.0 fallback; use an explicit workspace for local SDK work.

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
