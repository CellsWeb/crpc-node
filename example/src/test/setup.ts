/**
 * src/test/setup.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GLOBAL TEST LIFECYCLE & DATABASE RUNNER
 *
 * Configures the test environment before any tests run.
 * Supports dual-mode testing:
 *   - "memory": Spins up an isolated in-RAM MongoDB (mongodb-memory-server).
 *   - "real": Connects to a real test/staging database via TEST_MONGODB_URI.
 *
 * Automatically wipes collections between tests to guarantee absolute test isolation.
 */

import { beforeAll, afterAll, afterEach } from "vitest";

let mongodInstance: any = null;
let mongooseInstance: any = null;

beforeAll(async () => {
  const dbType = process.env.TEST_DB_TYPE || "memory";

  try {
    // Attempt dynamic import of mongoose if available in user project
    // @ts-ignore
    const mongooseMod = await import("mongoose").catch(() => null);
    if (mongooseMod?.default) {
      mongooseInstance = mongooseMod.default;
    } else if (mongooseMod) {
      mongooseInstance = mongooseMod;
    }

    if (mongooseInstance) {
      if (dbType === "memory") {
        // Attempt dynamic import of mongodb-memory-server
        // @ts-ignore
        const { MongoMemoryServer } = await import("mongodb-memory-server").catch(() => ({ MongoMemoryServer: null }));
        if (MongoMemoryServer) {
          mongodInstance = await MongoMemoryServer.create();
          const uri = mongodInstance.getUri();
          await mongooseInstance.connect(uri);
        }
      } else {
        const uri =
          process.env.TEST_MONGODB_URI ||
          process.env.MONGODB_URI ||
          "mongodb://127.0.0.1:27017/cellsweb_test";
        await mongooseInstance.connect(uri);
      }
    }
  } catch (err) {
    // If mongoose or mongodb-memory-server are not installed, proceed gracefully
    console.warn("Test DB setup note:", (err as Error).message);
  }
});

afterEach(async () => {
  // Wipe all database collections between tests for zero state pollution
  if (mongooseInstance && mongooseInstance.connection?.readyState === 1) {
    try {
      const collections = mongooseInstance.connection.collections;
      for (const key in collections) {
        await collections[key].deleteMany({});
      }
    } catch {}
  }
});

afterAll(async () => {
  if (mongooseInstance && mongooseInstance.connection?.readyState !== 0) {
    try {
      await mongooseInstance.disconnect();
    } catch {}
  }
  if (mongodInstance) {
    try {
      await mongodInstance.stop();
    } catch {}
  }
});
