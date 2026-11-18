# Shared protocol and compatibility boundaries

This is a contributor description of the released behavior, not a new wire
specification. Use it with the sibling runtime's source and equivalent fixtures.
Node and Go share semantic contracts while retaining different native APIs,
parsers, schema vocabularies and response details.

## HTTP envelope

A configurable endpoint (normally POST /rpc) receives an object with namespace,
functionName and data. The outer JSON value is an envelope object; the **data**
member may be an object, array, string, number, boolean or null if its schema
accepts it. Omitted HTTP data retains the empty-object default; explicit null
must reach schema validation as null/nil. Do not conflate envelope shape with
handler-input shape.

```json
{"namespace":"public","functionName":"hello","data":{"name":"Ada"}}
```

Success normally carries status:"ok", data and optional metadata. Some Go paths
omit nil output data under existing omitempty rules; explicit null input is a
separate guarantee. Errors have status:"error",
code, message and optional details/metadata. Successfully handled application
errors use HTTP200 by default, with explicit opt-in HTTP status mapping.
Framework/server framing errors, custom routes and unmatched paths may instead
use transport statuses or different non-RPC bodies.

Both interceptors in Node and sendErrorResponse in Go send their handled parsing
errors through the default HTTP200 path too. **Do not claim all malformed JSON,
routing conflicts or missing boundaries automatically become HTTP400.** Inspect
which layer produced the failure, plus its configuration. Clients inspect the
RPC status field instead of treating HTTP200 alone as success.

## Authentication, context and docs

Application middleware verifies credentials and authorization, in attachment
order, before the handler. Missing configured middleware fails closed. HTTP/IPC
callers forward headers; body/session/context objects remain untrusted data.
Server-local test/context APIs are not remote bypass controls.

isPublic/IsPublic are deprecated ignored compatibility fields. They neither
register/hide functions nor bypass authorization. No replacement visibility flag
exists. Documentation is enabled/disabled globally. Middleware docs project
structural schemas, descriptions and required headers, not resolved secret values.
Never place secrets in public prose, names or schema constraints.

## Multipart is a transport, not a second business API

The client emits namespace/functionName text parts before files and also sends
X-CRPC-Namespace/X-CRPC-Function. Header routing is an acceleration; required body
routing is redundant and must agree. Headers come as a pair. Reject duplicates
and conflicts rather than selecting an arbitrary source. Headerless fallback
requires routing fields before file parts. Required authorization precedes
application-owned file writes; this does not imply zero socket/runtime buffering.

File inputs are top-level fields or direct arrays of files. Nested files inside
objects are not supported by the shared client transport. Ordinary nested JSON
is separate. Text fields may be schema-coerced during multipart intake; ordinary
JSON does not receive blanket transport coercion. Preserve parser/schema bounds,
abort handling and temporary-file ownership.

## Shared intent and deliberate differences

| Boundary | Contributor implication |
|---|---|
| Node discovery / Go registration | Do not add filesystem discovery to Go to mimic Node. |
| TypeBox / native SchemaRule | Compare logical valid/invalid cases, not schema syntax. Optional/null/default semantics are not universally identical. |
| Native Node / Fetch / Go HTTP | Stream-driven Busboy, runtime-buffered formData, and transport-buffered fasthttp have different resource bounds. |
| HTTP / in-memory / IPC | HTTP omission defaults are not a promise about missing input on every call API. Return types and error/details/meta differ. |
| Unix / stdio IPC | Unix accepts bounded newline/length-prefixed requests; stdio uses a Scanner and has a smaller token boundary. |
| Browser / RN / Node client | Multipart chooses XHR whenever it exists; do not promise a custom fetchFn runs in browsers for files. |

Large integers, JSON duplicate members, extra properties, null outputs/omitempty,
Unicode limits, details fields and cancellation need explicit fixtures when
changed. Do not infer universal JSON Schema or byte-for-byte response parity.
For protocol changes, propose version/migration behavior first and test both
runtimes and every affected transport before seeking review.

See [Node internals](https://cellsweb.github.io/crpc-node/internals/) and
[Go internals](https://cellsweb.github.io/crpc-go/internals/).
