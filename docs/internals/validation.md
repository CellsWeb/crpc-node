# TypeBox validation and error projection

Source: [packages/rpc-core/src/utils/typebox.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/src/utils/typebox.ts),
[packages/rpc-core/src/errors.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/src/errors.ts) and
[packages/rpc-core/src/utils/json.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/src/utils/json.ts).

## What validates, and when

| Boundary | Owner | Failure prevents |
|---|---|---|
| Outer JSON object/routing identifiers | request/json.ts and request/routing.ts | Function lookup/dispatch |
| Middleware headers/options | executeMiddlewareChain | That middleware and subsequent handler |
| Function headers/input | runPipeline | Handler execution |
| File identity/MIME/size/count | validateSchema and registered file checks | Invalid upload reaching handler |
| Output schema | runPipeline after handler | Success envelope with invalid output |
| Envelope serialization | Interceptor/safeJsonStringify | An unhandled serialization exception |

TypeBox schemas are runtime objects carrying symbols, constraints/defaults and
transforms. validateSchema caches a normalized safe schema/checker per schema.
Normalization preserves every anyOf/allOf branch and nested items/properties.
An unconditional Type.Any branch would widen a union; do not add one to make
custom file types compile. Type.Optional concerns omission; explicit nullable
values need a declared null branch. Existing schema defaults/transforms apply
through the TypeBox path and must not mutate the contract object.

## File and form kinds

File/Files schemas retain custom kinds registered with TypeRegistry. Branch
checks call validateFileField, preserving actual UploadedFile identity, limits,
MIME rules and arrays. Multiple file alternatives must be tried as alternatives,
not by choosing the first file schema. File-bearing default selection preserves
opaque UploadedFile instances instead of letting generic clones erase methods.
Ordinary JSON defaults stay on TypeBox's native path.

FormNum/FormBool are explicit helper transforms. Normalization recognizes their
union kinds and decoding must occur once. They are not permission to coerce all
JSON strings/numbers globally. Multipart intake has its own schema-directed data
normalization. Nested validation of native file values does not imply the client
supports nested file-in-object transport.

## Error types and status selection

AppError carries code/message/details and whether the error is internal.
toAppError converts other exceptions; toClientPayload projects the client-facing
error. Input/header validation uses validation_error. A handler returning output
that violates its contract becomes schema_mismatch. Keep internal diagnostics in
server logs rather than exposing arbitrary exception details as public metadata.

The Node and Fetch interceptors catch handled errors, serialize an error envelope
and use HTTP200 by default. useHttpStatusCodes invokes the explicit mapper.
Unknown paths/OPTIONS/native parser rejections may be outside that RPC path;
never write tests that infer error vocabulary from status alone. Telemetry gets
the chosen code/duration, but failures in telemetry do not replace the RPC result.

## Type declarations are part of compatibility

The runtime JavaScript is CommonJS. Conditional exports provide .d.ts for require
and .d.mts for import so TypeBox's module-specific unique symbols match consumers.
[packages/rpc-core/scripts/emit-import-types.mjs](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/scripts/emit-import-types.mjs) emits the import
graph after tsc; [packages/rpc-core/scripts/test-types.mjs](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/scripts/test-types.mjs) packs and
installs a clean strict ESM/CJS consumer. Preserve relative declaration references
and inferred Static types. Do not solve symbol mismatches with any/ts-ignore.

## Tests to extend

[packages/rpc-core/src/union-validation.test.ts](https://github.com/CellsWeb/crpc-node/blob/main/packages/rpc-core/src/union-validation.test.ts) covers nullable
omission/wrong shapes, optional/nested unions, transforms/defaults, file branches,
file arrays, identity and HTTP handler non-execution. Add both accepted and
rejected values for a schema change. Run declaration consumers when an exported
helper/type changes, and test actual multipart transport for upload changes.
See [testing](testing.md) for commands and peer-runtime fixture differences.
