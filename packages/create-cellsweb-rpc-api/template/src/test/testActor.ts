/**
 * src/test/testActor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GENERIC USER FLOW & SECURITY AUDIT TEST ACTOR
 *
 * GUIDE FOR DEVELOPERS & AI CODERS:
 *  - Use `createTestActor()` to simulate real user personas and credentials (e.g. Admin, Editor, Customer, Guest, Partner).
 *  - Supports testing complete end-to-end user workflows:
 *      1. Creating resources as an authorized user.
 *      2. Attempting unauthorized access with unprivileged credentials (asserting blocked response).
 *      3. Asserting custom business logic and error feedback.
 *  - Runs in-memory with zero network overhead while executing the complete server lifecycle
 *    (middlewares, TypeBox schema contracts, and handler logic).
 *
 * USAGE:
 *  ```ts
 *  import { createTestActor } from "@/test/testActor";
 *
 *  // 1. Successful flow with authorized credentials:
 *  const admin = await createTestActor({ role: "admin", userId: "admin_1" });
 *  const result = await admin.call("admin.products.create", { name: "Engine Filter", price: 150 });
 *
 *  // 2. Security rejection flow with unprivileged credentials:
 *  const guest = await createTestActor({ role: "guest" });
 *  const raw = await guest.callRaw("admin.products.create", { name: "Engine Filter" });
 *  expect(raw.status).toBe("error");
 *  ```
 */

import { createTestCaller, type ExecuteResult, type TestCaller } from "@cellsweb/rpc-core";
import { app } from "@/server";

export interface TestActorCredentials {
  userId?: string;
  role?: string;
  token?: string;
  tenantId?: string;
  session?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TestActorOptions extends TestActorCredentials {
  headers?: Record<string, string | string[] | undefined>;
  contextOverrides?: Record<string, unknown>;
}

export interface TestActor {
  readonly userId: string;
  readonly role: string;
  readonly credentials: TestActorCredentials;
  readonly caller: TestCaller;
  setHeaders: (headers: Record<string, string | string[] | undefined>) => void;
  call: <T = unknown>(
    functionKey: string,
    payload?: unknown,
    overrides?: { headers?: Record<string, string | string[] | undefined>; contextOverrides?: Record<string, unknown> },
  ) => Promise<T>;
  callRaw: <T = unknown>(
    functionKey: string,
    payload?: unknown,
    overrides?: { headers?: Record<string, string | string[] | undefined>; contextOverrides?: Record<string, unknown> },
  ) => Promise<ExecuteResult<T>>;
}

/**
 * Factory for creating simulated test actors to audit complete user flows and server security rules.
 */
export async function createTestActor(options: TestActorOptions = {}): Promise<TestActor> {
  const { headers = {}, contextOverrides = {}, ...credentials } = options;

  const userId = credentials.userId || `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const role = credentials.role || "user";

  const activeCredentials: TestActorCredentials = {
    userId,
    role,
    ...credentials,
  };

  let activeHeaders: Record<string, string | string[] | undefined> = {
    authorization: credentials.token ? `Bearer ${credentials.token}` : undefined,
    ...(headers || {}),
  };

  const getCaller = (callOverrides?: {
    headers?: Record<string, string | string[] | undefined>;
    contextOverrides?: Record<string, unknown>;
  }) => {
    const mergedHeaders = {
      ...activeHeaders,
      ...(callOverrides?.headers || {}),
    };

    const mergedContext = {
      auth: { ...activeCredentials },
      ...contextOverrides,
      ...(callOverrides?.contextOverrides || {}),
    };

    return createTestCaller(app, {
      headers: mergedHeaders,
      contextOverrides: mergedContext,
    });
  };

  const actor: TestActor = {
    userId,
    role,
    credentials: activeCredentials,
    caller: getCaller(),
    setHeaders: (newHeaders) => {
      activeHeaders = { ...activeHeaders, ...newHeaders };
    },
    call: async <T = unknown>(functionKey: string, payload?: unknown, overrides?: { headers?: Record<string, string | string[] | undefined>; contextOverrides?: Record<string, unknown> }): Promise<T> => {
      const caller = getCaller(overrides);
      return caller.call<T>(functionKey, payload);
    },
    callRaw: async <T = unknown>(functionKey: string, payload?: unknown, overrides?: { headers?: Record<string, string | string[] | undefined>; contextOverrides?: Record<string, unknown> }): Promise<ExecuteResult<T>> => {
      const caller = getCaller(overrides);
      return caller.callRaw<T>(functionKey, payload);
    },
  };

  return actor;
}
