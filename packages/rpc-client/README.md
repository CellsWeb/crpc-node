# @cellsweb/rpc-client

Candidate 1.0.24 is prepared, not published here; public 1.0.23 is older. Node
tooling/runtime policy is >=24.0.0. Browser/React Native fetch and file support
remain separate from Node's engine declaration.

Import createRpcClient/RpcError from @cellsweb/rpc-client. Import RpcProvider,
useRpcQuery and useRpcMutation from @cellsweb/rpc-client/react. React is optional
for base-package consumers; hooks accept a single options object and need a
provider. request/rawRpcRequest unwrap successful data and throw RpcError.

Multipart accepts top-level files and direct arrays; nested file objects remain
unsupported. Forward credentials in headers, not trusted context/session data.
See repository docs/client.md and docs/uploads.md for compiling examples and
RELEASE.md for installation of the unpublished candidate tarballs.
