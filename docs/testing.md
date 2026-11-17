# Testing

`createTestCaller` exercises the in-memory pipeline, not an HTTP listener.
`call` unwraps data/throws AppError; `callRaw` returns the application envelope.
Neither skips authentication or schema validation. Supply test credentials in
headers and an application verifier fixture that recognizes them.

<!-- compile: testing.ts -->
```typescript
import { CoreRPC, createTestCaller } from '@cellsweb/rpc-core';
export async function testHello() {
  const app = new CoreRPC({ functionsDir: './dist/functions', middlewaresDir: './dist/middlewares', docs: false });
  const caller = createTestCaller(app, { headers: { authorization: 'Bearer test-credential' } });
  const result = await caller.callRaw('public.hello', { name: 'Test' });
  await app.close();
  return result;
}
```

There is no `app.init()` method; getRegistry/createHandler/fetch/execute load the
registry as needed. Local context overrides are controlled test facilities, not
a transport interface or an authorization bypass.

Source validation: `pnpm build`, `pnpm typecheck`, `pnpm test`. Generated projects
use `npm run typecheck`, `npm run build`, `npm test`. Live HTTP tests are also
needed for socket draining, multipart disconnect/cleanup, headers and adapter
intake; an in-memory test cannot establish transport behavior.

`crpc test:audit` invokes Vitest with verbose/JSON reporters and writes
`audit-reports/security-audit.json`. It does not discover every function's auth
policy, create an HTML security certificate, or independently certify security.
