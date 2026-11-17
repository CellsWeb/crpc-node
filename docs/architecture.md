# Architecture and protocol

HTTP RPC dispatch uses one configured endpoint, normally POST /rpc:

```json
{"namespace":"public","functionName":"hello","data":{"name":"Alice"}}
```

Success is `{status:'ok',data,meta?}`; application errors are
`{status:'error',code,message,details?}`. Default handled application errors use
HTTP 200. `useHttpStatusCodes:true` opts into status mapping. Transport/framing
failures, custom HTTP routes and disabled/unknown documentation paths have their
own statuses. HTTP 200 is not a proxy-cache/security guarantee; configure caches
and monitoring for the actual envelope and route policy.

JSON objects, arrays, scalars and explicit null preserve their shape. Omitted
HTTP data defaults to `{}`; schema validation decides whether it is accepted.
Middleware authenticates/authorizes before handler execution. Input and output
validation remain active; no remote session/context bypass is provided.

Native Node intake streams JSON/multipart with bounded handling of rejected
bodies. Fetch formData can buffer at its runtime boundary. Go fasthttp is
transport-buffered before application multipart processing. Per-request limits
and cleanup do not establish a zero-allocation or aggregate-memory guarantee.

Multipart requires both accelerated routing headers or neither, exact header/body
agreement and routing text before files for headerless fallback. Only top-level
files/direct arrays are supported. MIME detection is heuristic, not sanitization.

Node TypeBox and Go native schemas have semantic overlap, not identical keyword,
number or error-detail behavior. Node JSON.parse and Go HTTP JSON v2 differ on
duplicate members; large integer and omitted-output conventions need explicit
application contracts. See the sibling Go guide for bounded IPC 2 MiB framing and
no-replay failure handling.

Documentation is globally configured and never grants access to functions.
Deprecated isPublic is ignored; middleware owns auth. Public schema projections
omit configured middleware values/defaults but cannot classify secrets placed
intentionally in public descriptions or constraints.
