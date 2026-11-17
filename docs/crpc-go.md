# Go interoperability

Node and Go share the HTTP request shape and default application-error envelopes.
Go 1.0.1 is the prepared hardened candidate; public v1.0.0 predates its verified
fixes. Use a workspace for local Go candidate testing and the exact new module
version after it is actually published. See the Go repository's current guide.

Both runtimes preserve explicit HTTP null and default omitted HTTP data to {}.
TypeBox unions and native Go optional/nullable schemas still have different
vocabularies. Shared fixtures cover logical shapes/auth/validation, not every
JSON Schema keyword, numeric boundary or serialization detail.

The Go repository's verified example-node/src/client.ts is the Unix IPC client.
Forward credentials in headers. Anonymous connection errors and malformed JSON
retire that connection and reject pending calls; reconnection does not replay
failed work. Frame maximum is 2,097,152 bytes; newline counts for line frames,
four-byte prefix is separate for length frames. Do not copy stale client code or
claim remote middleware skipping/context injection is supported.

Docs parity means no badges, ignored legacy isPublic/IsPublic, schema/header
descriptions and private configured-option values excluded. Node global docs
env names differ from Go DOCS_ENABLED/DOCS_PATH. Auth remains application
middleware in both; Go middleware schemas do not introduce runtime validation.
