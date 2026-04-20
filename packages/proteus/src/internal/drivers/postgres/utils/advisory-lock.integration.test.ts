import { randomBytes } from "crypto";
import { Client } from "pg";
import { createTestPgClient } from "../../../__fixtures__/create-test-pg-client";
import type { PostgresQueryClient } from "../types/postgres-query-client";
import { withAdvisoryLock } from "./advisory-lock";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const KEY_1 = 0x54455354; // "TEST"
const KEY_2 = 0x4c4f434b; // "LOCK"

let clientA: PostgresQueryClient;
let rawA: Client;
let clientB: PostgresQueryClient;
let rawB: Client;

beforeAll(async () => {
  ({ client: clientA, raw: rawA } = await createTestPgClient());
  ({ client: clientB, raw: rawB } = await createTestPgClient());
});

afterAll(async () => {
  await rawA.end();
  await rawB.end();
});

describe("withAdvisoryLock (integration)", () => {
  it("should acquire lock, run callback, and release", async () => {
    let callbackRan = false;

    const result = await withAdvisoryLock(clientA, KEY_1, KEY_2, async () => {
      callbackRan = true;
      return "ok";
    });

    expect(callbackRan).toBe(true);
    expect(result).toBe("ok");
  });

  it("should return null when lock is already held by another session", async () => {
    // Manually acquire lock on connection A
    await rawA.query("SELECT pg_try_advisory_lock($1, $2)", [KEY_1, KEY_2]);

    try {
      let callbackRan = false;

      const result = await withAdvisoryLock(clientB, KEY_1, KEY_2, async () => {
        callbackRan = true;
        return "should not happen";
      });

      expect(result).toBeNull();
      expect(callbackRan).toBe(false);
    } finally {
      await rawA.query("SELECT pg_advisory_unlock($1, $2)", [KEY_1, KEY_2]);
    }
  });

  it("should allow second session to acquire after first releases", async () => {
    const resultA = await withAdvisoryLock(clientA, KEY_1, KEY_2, async () => "a");
    expect(resultA).toBe("a");

    // Lock released — B should now succeed
    const resultB = await withAdvisoryLock(clientB, KEY_1, KEY_2, async () => "b");
    expect(resultB).toBe("b");
  });

  it("should release lock even when callback throws", async () => {
    await expect(
      withAdvisoryLock(clientA, KEY_1, KEY_2, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    // Lock should be released — B can acquire
    const result = await withAdvisoryLock(clientB, KEY_1, KEY_2, async () => "recovered");
    expect(result).toBe("recovered");
  });

  it("should allow different key pairs concurrently", async () => {
    const OTHER_KEY_2 = 0x4f544852; // "OTHR"

    let aRan = false;
    let bRan = false;

    const [resultA, resultB] = await Promise.all([
      withAdvisoryLock(clientA, KEY_1, KEY_2, async () => {
        aRan = true;
        return "a";
      }),
      withAdvisoryLock(clientB, KEY_1, OTHER_KEY_2, async () => {
        bRan = true;
        return "b";
      }),
    ]);

    expect(aRan).toBe(true);
    expect(bRan).toBe(true);
    expect(resultA).toBe("a");
    expect(resultB).toBe("b");
  });
});
