---
layout: default
title: In-Process Testing & Security Audits
nav_order: 11
---

# In-Process Testing & Security Audits

CellsWeb RPC features a high-speed in-process testing harness that runs directly in memory without binding network ports.

---

## ⚡ In-Process Testing with `createTestCaller`

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { CoreRPC, createTestCaller } from "@cellsweb/rpc-core";

describe("User RPC Integration Tests", () => {
  let caller: ReturnType<typeof createTestCaller>;

  beforeAll(async () => {
    const app = new CoreRPC({
      functionsDir: "./src/functions",
      middlewaresDir: "./src/middlewares",
    });
    await app.init();

    // Create in-memory caller with default test auth headers
    caller = createTestCaller(app, {
      headers: {
        authorization: "Bearer valid_test_token",
      },
    });
  });

  it("should retrieve user profile successfully", async () => {
    const user = await caller.call("user.getProfile", { id: "usr_101" });
    expect(user.id).toBe("usr_101");
    expect(user.email).toBeDefined();
  });
});
```

---

## 🔍 Asserting Error Boundaries with `callRaw`

Use `caller.callRaw()` to inspect HTTP 200 error envelopes without throwing exceptions:

```typescript
it("should return validation_error when input is invalid", async () => {
  const response = await caller.callRaw("user.getProfile", {});

  expect(response.status).toBe("error");
  expect(response.code).toBe("validation_error");
  expect(response.details).toBeInstanceOf(Array);
  expect(response.details[0].field).toBe("id");
});

it("should return unauthorized when token is missing", async () => {
  // Test caller without auth headers
  const unauthCaller = createTestCaller(app, {});
  const response = await unauthCaller.callRaw("user.getProfile", { id: "usr_101" });

  expect(response.status).toBe("error");
  expect(response.code).toBe("unauthorized");
});
```

---

## 🛡️ Security Audit Verification (`pnpm test:audit`)

CellsWeb RPC includes an automated client security audit engine. It tests all functions for:
1. Public exposure boundaries
2. Authentication enforcement
3. Role-based privilege escalation
4. Input injection containment

Run the security audit:

```bash
pnpm run test:audit
```

This outputs a comprehensive audit summary and generates a client-ready HTML audit certificate in `test-reports/audit.html`.
