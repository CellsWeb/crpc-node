# Embedded documentation renderer

The framework's interactive /docs is separate from this MkDocs contributor site.
Source: [packages/rpc-core/src/docs/renderer.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/src/docs/renderer.ts), with routing in
[packages/rpc-core/src/core-rpc.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/src/core-rpc.ts).

## Input, views and routing

CoreRPC loads the registry and globally gates documentation before calling
renderDocsHtml(registry, serverUrl, pathname, rpcEndpoint, docsEndpoint).
Native HTTP passes its relative URL; Fetch passes parsed URL.pathname.
The renderer normalizes the configured docs path, strips query/trailing slash
syntax, resolves function or middleware details and falls back to the index for
unknown documentation paths. The caller's docs switch determines accessibility;
renderer classification is not authorization.

buildSidebar, renderDocsIndex, renderFunctionDoc and renderMiddlewareDoc use the
same registry. Details include input/output contracts, function middleware,
options/header structures, descriptions, required headers and placeholder cURL.
Custom documentation and RPC endpoints must propagate through every link/example.
Do not hard-code /docs when an endpoint parameter exists.

## Public projection versus live options

middlewareSchemaForDocs recursively projects schema structure and drops value
annotations such as default/example/const/enum and private extensions. It does
not read resolved per-function middleware option values. Required lists drive
required-header display and cURL placeholders. Projection must not mutate schema
objects or execute middleware/handlers. Keep descriptions/names free of secrets;
no renderer can detect secrets deliberately embedded in public prose/constraints.
Function input/output schema rendering has its own contract and is not a blanket
redaction promise for arbitrary application metadata.

isPublic remains a deprecated ignored field. There are no PUBLIC/PRIVATE badges,
per-function visibility opt-outs or auth bypasses. All registered functions may
appear when docs are enabled. Node raw-core defaults and generated env parsing
are described in the [public configuration guide](../getting-started.md); do not
silently change global switches while editing HTML.

## Safe renderer changes

1. Trace index/sidebar/search/directory and direct detail paths for the feature.
2. Assert actual page content, input/output trees and per-function middleware.
3. Test custom endpoints/query parameters/unknown routes and Node/Fetch parity.
4. Test docs disabled: index/details/schema-like/metadata paths must not expose docs.
5. Inject configured/schema secrets in fixtures and verify public views do not
   reveal them; also verify schemas and application execution are unchanged.
6. Test deprecated metadata true/false/omitted without affecting visibility.

[packages/rpc-core/src/docs-parity.test.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/src/docs-parity.test.ts) checks safe projections
and behavior; [packages/rpc-core/src/fetch-docs.test.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/src/fetch-docs.test.ts) checks URL
routing/content and HTTP/Fetch parity. Generated adapter probes cover the complete
app boundary. A successful MkDocs build does not exercise this runtime renderer.
See [Go renderer internals](https://cellsweb.github.io/crpc-go/internals/renderer/)
for its native schema projection and intentionally different unknown-route behavior.
