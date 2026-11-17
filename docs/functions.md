# Functions and contracts

A namespace maps to directories below `functionsDir`. Each function exports
contracts, optional middleware attachments and a named or default `run` handler.
Use the generator to create the current layout; imports below use emitted `.js`
paths so the examples also compile under NodeNext.

<!-- compile: functions/hello/constants.ts -->
```typescript
import { Type, type Static } from '@sinclair/typebox';
export const metadata = { description: 'Greet a named caller', tags: ['example'] };
export const contentType = 'application/json';
export const inputSchema = Type.Object({ name: Type.String({ minLength: 1 }) });
export const outputSchema = Type.Object({ greeting: Type.String() });
export type Input = Static<typeof inputSchema>;
export type Output = Static<typeof outputSchema>;
```

<!-- compile: functions/hello/run.ts -->
```typescript
import type { MiddlewareContext } from '@cellsweb/rpc-core';
import type { Input, Output } from './constants.js';
export async function run(input: Input, _context: MiddlewareContext): Promise<Output> {
  return { greeting: `Hello, ${input.name}!` };
}
```

<!-- compile: functions/protected/middlewares.ts -->
```typescript
import { defineMiddlewares } from '@cellsweb/rpc-core';
export const middlewares = defineMiddlewares([{ name: 'auth', options: { role: 'reader' } }]);
```

The last block belongs to a protected function; the basic hello handler can run
without it. The attachment refers to an application middleware module. It executes before
input validation and the handler; output validation still runs before success.
The framework exports `MiddlewareContext`, not a `Context` type. Request identity
must be populated by verified middleware, not trusted from remote request data.

`metadata` may describe the function, tags and deprecation. The optional legacy
`FunctionMetadata.isPublic` remains deprecated and ignored. It controls no docs
visibility, authentication, registration or execution. New modules omit it.

HTTP data preserves object/array/scalar/null shape. Omitted data defaults to an
empty object; a nullable string union therefore rejects omission but accepts
explicit null. [Schemas](schemas.md) define which shapes a handler accepts.
