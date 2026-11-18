# @cellsweb/rpc-client

Client **1.0.25**: `npm install @cellsweb/rpc-client@1.0.25`. Node
tooling/runtime policy is >=24.0.0. Browser/React Native fetch and file support
remain separate from Node's engine declaration.

Import createRpcClient/RpcError from @cellsweb/rpc-client. Import RpcProvider,
useRpcQuery and useRpcMutation from @cellsweb/rpc-client/react. React is optional
for base-package consumers; hooks accept a single options object and need a
provider. request/rawRpcRequest unwrap successful data and throw RpcError.

Multipart accepts top-level files and direct arrays; nested file objects remain
unsupported. Forward credentials in headers, not trusted context/session data.
See repository docs/client.md and docs/uploads.md for compiling examples and
the repository installation guide for public packages and release engineering.
