# Candidate release and migration

Prepared versions are core 1.0.34, client 1.0.24 and scaffolder 1.0.30; public latest
checked during preparation was 1.0.33/1.0.23/1.0.29. The candidate is not published
by this work. Use local tarballs for candidate validation, and install exact new
versions only after author-approved publication. The repository RELEASE.md lists
package order, Go coordination, checks and fast-forward approval gates.

Node 24 LTS is primary, with declared/tested floor 24.0.0. Bun 1.3.11 is tested
independently. The engine policy is explicit; no shim or older-runtime guarantee
was added. Review package-manager engine-strict behavior when upgrading tooling.

Unions now enforce their declared branches, including nullable primitives and
file constraints. Invalid values return validation_error; explicitly declare
intended inputs instead of relying on the previous wildcard. Omitted HTTP data
remains {}, explicit null remains null subject to the input schema.

Remove deprecated isPublic from new metadata; existing optional fields remain
ignored. All registered functions may appear in globally enabled docs. There
are no PUBLIC/PRIVATE badges or replacement visibility flags. Authentication and
authorization remain middleware responsibilities; do not use caller context or
middleware-skip examples. Forward credentials in headers.

Review generated server changes manually if you customized adapters. All seven
templates preserve JSON, multipart routing consistency, bounds and cleanup;
production docs require explicit enablement. Direct raw-core and generated env
parsing differ as documented in [configuration](getting-started.md).

Go's coordinated candidate isv1.0.1, not the older public v1.0.0. A source-built
Go CLI retains the real old fallback; use an explicit workspace until the new
matching CLI/SDK release is public. IPC connection failures reject pending calls
without automatic replay; Unix framing remains 2 MiB with documented delimiter rules.
