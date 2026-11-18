# Changelog

Public release: core 1.0.34, client 1.0.24 and scaffolder 1.0.30. See
[installation](docs/getting-started.md) and [release engineering](RELEASE.md).

## @cellsweb/rpc-core 1.0.34

- Enforce every declared union branch. Invalid objects/arrays no longer bypass a
  nullable/string contract. File branches retain physical file identity, MIME,
  size/count limits, branch defaults and form transforms.
- Include verified JSON body draining, Fetch documentation detail routing,
  Fastify multipart intake and Ultimate Express completed-upload handling.
- Retire documentation badges while retaining deprecated, ignored `isPublic`.
  Middleware docs expose schemas, not configured secret values/defaults.
- Supply module-mode-matched TypeBox declarations for strict ESM and CommonJS
  consumers; both use the same existing JavaScript implementation.
- Declare Node >=24.0.0; Node 24 LTS is primary. Bun is tested separately. No
  compatibility shims were added for older Node releases.

## @cellsweb/rpc-client 1.0.24

- Declare the same Node tooling/runtime policy and exclude emitted test files
  from package contents. Base and `/react` exports remain unchanged.
- Include the existing top-level/direct-array multipart file policy. Nested file
  objects remain unsupported; this release does not introduce a new wire format.

## create-cellsweb-rpc-api 1.0.30

- Require `@cellsweb/rpc-core:^1.0.34` in generated projects and Node >=24.0.0.
- Include verified production docs guards, typed binary handling and all seven
  adapter templates. Generate no deprecated visibility/badge metadata.

## Migration

Use Node 24 LTS for supported Node execution. Older versions can work naturally,
but are outside the declared/tested range; no Node 20 workaround is provided.
Bun remains a separate supported execution option, tested with Bun 1.3.11.

Review schemas that relied on the old union wildcard: explicitly list intended
types. Invalid input returns the existing HTTP 200 `validation_error` envelope;
do not add `Type.Any()` merely to conceal a validation failure. Explicit JSON
null is distinct from omitted HTTP `data` (which defaults to `{}`).

Remove `isPublic` from new application metadata. Existing typed fields remain
compatible and ignored. Authentication/authorization belong to middleware; a
remote caller cannot skip it or inject trusted identity. Disable public docs
globally when needed; no replacement visibility flag exists.

Generated-project upgrades should review template changes before applying them
to customized servers. Existing apps are not rewritten automatically. Headered
multipart routing must agree with body routing; headerless routing remains
supported. Application-error envelopes, schema validation and upload cleanup
remain in force.
