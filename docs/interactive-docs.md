# Interactive documentation

The documentation index lists every registered function and middleware. Function
pages show input/output contracts, descriptions, tags, deprecation status and the
attached middleware pipeline. Middleware cards and detail pages show option and
header names, types, descriptions, nested fields and required/optional status.
Required headers appear in function header tables and cURL placeholders for both
JSON and multipart calls. Optional headers remain documented without becoming
mandatory in the examples. Middleware links respect a custom docs endpoint.

## Global configuration

Use `new CoreRPC({ docs: false })` to disable documentation, or configure
`docsEndpoint` to change its path (default `/docs`). Explicit application options
take precedence over environment values. Direct CoreRPC construction enables
docs outside production; in production it requires `API_DOCS_ENABLED` to equal
the string `true`. `API_DOCS_ENDPOINT` supplies the default docs path.

CLI-generated servers use their existing typed environment module and production
guard. That module parses supported boolean strings before passing an explicit
`docs` option. Disabling documentation blocks index, function and middleware
pages; it does not unregister functions or change RPC execution.

The generated boolean parser accepts trimmed, case-insensitive true/false/1/0;
invalid values fall back to false. Outside production the template keeps docs
enabled even for an env false value; an explicit application docs:false disables
them everywhere. Dotenv does not overwrite process exports. Raw CoreRPC does not
load dotenv or use that parser. Go generated servers instead use exported
DOCS_ENABLED/DOCS_PATH, reject invalid nonblank booleans and do not load .env.

Index, function and middleware detail pages share the global switch. With docs
disabled, related docs/metadata/schema paths do not expose documentation. Query
parameters and custom docs endpoints work in native and Fetch handlers. Unknown
docs paths retain the existing Node index fallback; Go retains404.

## Public schema metadata and private configuration

The UI documents schemas, never per-function middleware option values. It does
not read or serialize those configured values, even when a middleware has no
schema. Middleware schema defaults, examples, constants, enum values and private
extensions are omitted from the public projection, including nested schemas.
Types, descriptions, required fields and structural constraints remain visible.
Function input/output contracts retain their existing rendering.

Keep secrets out of names, descriptions and other public schema metadata. The
renderer cannot classify secrets deliberately written into public prose or
constraints. Metadata rendering does not mutate schemas, apply defaults, execute
middleware or introduce validation. Existing execution-time behavior is unchanged.

## Deprecated metadata compatibility

`FunctionMetadata.isPublic?: boolean` is retained for existing typed user code.
It is **deprecated and ignored**: it has no documentation visibility,
authentication or authorization meaning. Omitted, `true` and `false` values have
the same framework behavior. PUBLIC/PRIVATE badges have been removed; new
generators and examples omit this field. No replacement visibility flag exists.
The property may be removed in a future major release.

Go follows the same documentation policy. Its existing
`rpc.FunctionMetadata.IsPublic bool` remains zero-value compatible; middleware
documentation uses `rpc.MiddlewareMetadata` and native `schema.SchemaRule` values.
