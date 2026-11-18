# Release engineering and compatibility review

The public coordinated baseline is Node core 1.0.34/client 1.0.24/scaffolder 1.0.30
and Go module/CLI v1.0.1. This page explains future maintainer responsibilities;
contributing a PR does not authorize pushing, tagging or publishing.

## Version and artifact boundaries

Node has three public npm workspaces plus a private root. Core runtime/helpers,
client/React exports and the initializer have separate versions. Generated Node
apps currently require core^1.0.34, so a new scaffolder must never require a core
version that has not been published. Check actual registry state, not just local
package manifests or a changed version string. Stable ranges do not select an
unrelated prerelease; prerelease testing needs explicit versions/ranges/dist-tags.

Go is one root module, github.com/CellsWeb/crpc-go. Root tags select both SDK and
cmd/crpc-go; no separate invented CLI tag is needed. An installed versioned CLI
uses its module version for the generated dependency. Source/VCS builds still
use the real older v1.0.0 fallback; select a local SDK explicitly with a workspace.
A CLI printing1.0.1 is not by itself evidence of generated SDK selection.

## Review and integration gates

- Agree scope/version/migration policy before changing public APIs, defaults or
  wire behavior. Preserve the shared invariants and test both runtimes when affected.
- Record baseline/new SHAs and exact red/green commands. Run runtime-specific full
  builds/tests/typechecks/vet/race and real adapter/IPC tests where applicable.
- Review docs examples, configuration precedence, ignored legacy metadata, error
  envelopes and resource ownership. Test actual package declarations/executables.
- Use a clean worktree to preserve unrelated edits. Refresh default/upstream refs,
  confirm ancestry and integrate only the approved commit. Never force history or
  overwrite a published version/tag to rescue a failed release.

## Distribution sequence

1. After explicit release approval, recheck registry/tag absence, credentials,
   package names, engines/dependencies/exports/bins and exact artifacts. npm pack
   --dry-run and an inspected actual pack are separate from publishing.
2. Publish the new core before any scaffolder requiring its new range, and publish
   the client at its own approved version. Use the official public registry and
   required public access. Prefer browser authentication; the maintainer completes
   passkey/2FA personally. Never ask for credentials in a PR or report.
3. Create the approved new Go root-module tag at the verified commit; check the
   public proxy/checksum database before advertising its matching CLI/SDK install.
   Keep one publishing operation at a time and inspect each actual result.
4. Repeat real installs in independent projects with fresh public caches and no
   local SDK links/replacements/workspaces/tarball overrides. Generate with
   npm create cellsweb-rpc-api@latest or a pinned initializer; build/typecheck/test
   and send actual JSON/multipart/error/docs HTTP requests on all seven adapters.
5. Install the exact public Go CLI, generate an app, verify its go.mod and go list
   -m version, build/test/run HTTP and check IPC with the maintained Node client.
   Do not silently fall back to older code when propagation is delayed.
6. Record published versions, integrity/module sums, remote SHAs/tag target and
   actual public-install results. Only then describe distribution as complete.

Both existing GitHub Pages workflows deploy docs on relevant main pushes. Review
that timing and published-status prose; changing MkDocs source does not update an
already-published immutable npm tarball's bundled README. No CI/workflow changes
are implied by this guide. User installation examples are in
[getting started](../getting-started.md); migration keeps useful history from
v1.0.0/older npm versions without calling released artifacts unpublished.
