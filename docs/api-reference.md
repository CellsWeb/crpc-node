# Public API reference

This describes core 1.0.34 and client 1.0.25 exports. See
[installation](getting-started.md) and the generated package declarations.

`@cellsweb/rpc-core` exports CoreRPC, CoreRpcOptions, middleware/registry types,
AppError/ErrorCode, createTestCaller, UploadedFile, File/Files, FormNum/FormBool,
schema validation and adapter helpers. The generated `.d.ts` files are the exact
API reference; examples in [functions](functions.md) and [middleware](middlewares.md)
are compiled against those declarations.

## CoreRPC

Options include functionsDir, middlewaresDir, rpcEndpoint, docsEndpoint,
healthEndpoint, host, port, docs, strict, cors, trustProxy, useHttpStatusCodes,
onTelemetry. Explicit options win over their implemented environment defaults.

| Method | Purpose |
|---|---|
| getRegistry() | Load/access discovered functions and middleware |
| createHandler() | Await a Node request/response handler |
| fetch(Request) | Dispatch Web requests |
| start(port?) | Start native Node HTTP |
| close() | Close framework-owned server/workers |
| execute(key,data,options?) | In-memory envelope execution |
| fastifyPlugin(), honoPlugin(), elysiaPlugin() | Adapter factories |
| serveBun(port?) | Start under Bun |

There is no exported Context alias or init() lifecycle. Use MiddlewareContext.
MiddlewareFn receives its params object and context; it returns a context. See
[adapters](adapters.md) for actual factory mounting and buffering qualifications.

## Errors, files and clients

Handled application errors use `{status:'error',code,message,details?}` with HTTP 200
by default; success is `{status:'ok',data,meta?}`. Opt-in HTTP mapping, transport
failures, custom routes and docs404 are separate. AppError is the server error;
RpcError is the client error. Telemetry reports requestId, durationMs, status and
optional namespace/function/code/message/clientIp/userAgent/error fields.

UploadedFile properties: path, filename, byteLength, mimeType, declaredMimeType,
detectedMimeType. Methods: createReadStream, toBuffer, toBlob. Avoid obsolete
filepath/mimetype/size examples; Go's file API instead uses native methods.

`@cellsweb/rpc-client` exports createRpcClient, RpcClient, rawRpcRequest, RpcError
and request/response types. React is at `/react`, with RpcProvider, useRpcClient,
useRpcQuery and useRpcMutation. Hooks take options objects, not positional route
arguments. See the [client guide](client.md) for compiling examples.

`FunctionMetadata.isPublic?:boolean` is retained, deprecated and ignored. It
controls no docs visibility, authentication or execution. No replacement flag
exists; global docs configuration and application middleware are independent.
