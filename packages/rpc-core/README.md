# @cellsweb/rpc-core

Public release **1.0.34**: `npm install @cellsweb/rpc-core@1.0.34`.
Node >=24.0.0 (Node 24 LTS primary); Bun is tested independently. The core exports
CoreRPC, TypeBox/file helpers, middleware types, adapters and the local crpc CLI.

Create a handler with `await app.createHandler()`, use `app.fetch(request)` for
Fetch intake, and load a registry with `await app.getRegistry()` when needed.
There is no init() method. Handler context is MiddlewareContext. Use File/Files
for physical uploads; data/schema shapes, output validation and middleware remain
enforced. Unions no longer contain an implicit wildcard.

Authentication belongs to application middleware. Remote callers cannot skip it
or inject a trusted identity. isPublic remains a deprecated ignored compatibility
property; there are no badges or replacement visibility flags. Configure docs
globally and keep secrets out of public descriptions.

See the repository's docs/functions.md, docs/middlewares.md, docs/api-reference.md,
CHANGELOG.md and RELEASE.md for compiling examples and approved release gates.
