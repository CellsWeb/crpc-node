# Release and migration

Release versions: core 1.0.34, client 1.0.25 and scaffolder 1.0.30. Install them
from public npm; no local tarball substitution is needed. These supersede
core 1.0.33/client 1.0.23/scaffolder 1.0.29 for this hardening release. Preserve the
following migration notes when upgrading an existing application.

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

Go v1.0.2 adds bounded stdio framing. Install its versioned CLI to generate an SDK v1.0.2
dependency. A source/VCS-built Go CLI still selects the older v1.0.0 fallback;
use an explicit workspace only when intentionally testing a local SDK checkout. IPC connection failures reject pending calls
without automatic replay; Unix framing remains 2 MiB with documented delimiter rules.
