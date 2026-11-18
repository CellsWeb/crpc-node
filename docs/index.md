# CellsWeb RPC Node

Build schema-validated RPC functions with a shared middleware pipeline across
Node/Bun HTTP adapters. See [release status and installation](getting-started.md)
for public core 1.0.34, client 1.0.24 and scaffolder 1.0.30.

- [Functions](functions.md) and [schemas](schemas.md)
- [Middleware and authentication](middlewares.md)
- [Client/React](client.md) and [multipart uploads](uploads.md)
- [Seven adapters](adapters.md) and [global docs controls](interactive-docs.md)
- [CLI](cli.md), [testing](testing.md), [workers](workers.md)
- [Protocol](architecture.md), [API reference](api-reference.md), [Go sibling](crpc-go.md)

Node 24 LTS is primary; declared Node floor 24.0.0 is tested directly. Bun is
tested independently. The deprecated isPublic property is ignored, and auth is
enforced by middleware rather than documentation metadata.

## For contributors

Start with [contribution policy](contributing.md), [development setup](development.md)
and the [internal source map](internals/index.md). The sidebar separates end-user
usage from implementation, testing and release guides. See the [security policy](security.md)
and [Code of Conduct](code-of-conduct.md) before opening a report.
