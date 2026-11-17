# Middleware and authentication

Middleware receives `({headers, options, function}, context)` and returns the
context for the next stage. Use the registered middleware name to namespace
application state. Credential/session verification and authorization are the
application's responsibility; the framework does not supply a JWT provider.

<!-- compile: middlewares/auth/constants.ts -->
```typescript
import { Type } from '@sinclair/typebox';
export const metadata = { description: 'Verify a bearer session and required role' };
export const optionsSchema = Type.Object({ role: Type.Optional(Type.String()) });
export const headersSchema = Type.Object({ authorization: Type.Optional(Type.String()) });
```

<!-- compile: middlewares/auth/run.ts -->
```typescript
import { AppError, ErrorCode, type MiddlewareFn } from '@cellsweb/rpc-core';
type Session = { userId: string; role: string };
// Application integration point. This example denies until you implement it.
async function verifySession(_token: string): Promise<Session | null> { return null; }
export const run: MiddlewareFn<{ role?: string }, { auth: Session }> = async (
  { headers, options }, context,
) => {
  const raw = headers.authorization;
  if (typeof raw !== 'string' || !raw.startsWith('Bearer '))
    throw new AppError(ErrorCode.UNAUTHORIZED, 'Bearer credentials required');
  const session = await verifySession(raw.slice(7));
  if (!session) throw new AppError(ErrorCode.UNAUTHORIZED, 'Invalid credentials');
  if (options.role && session.role !== options.role)
    throw new AppError(ErrorCode.FORBIDDEN, 'Insufficient role');
  return { ...context, auth: session };
};
```

Attach middleware with `defineMiddlewares` in a function's `middlewares.ts`.
The Node pipeline validates its declared options/headers, then invokes it in
attachment order. Missing configured middleware fails closed. Header schemas
are contracts; mark authorization optional when the middleware should issue its
own unauthorized response rather than a header-schema validation error.

HTTP/IPC callers forward credentials in headers. There is no supported remote
`skipMiddlewares` or trusted `context` injection option. A browser/SSR session
object sent as JSON remains untrusted application data. Local test context
helpers are not a remote authentication interface.

Go uses the same auth responsibilities but native `schema.SchemaRule` metadata;
Go middleware option/header schemas document contracts without adding automatic
runtime validation. Go middleware must validate what it needs explicitly.

Docs show schemas, descriptions and required headers, never configured option
values/defaults. Keep secrets out of public descriptions. Deprecated isPublic
has no authorization meaning and is ignored.
