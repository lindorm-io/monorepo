import type { PostgresQueryClient } from "../types/postgres-query-client.js";
import { withAdvisoryLock } from "./advisory-lock.js";
import { describe, expect, it, vi } from "vitest";

const KEY_1 = 0x50524f54; // "PROT"
const KEY_2 = 0x53594e43; // "SYNC"

const makeClient = (
  locked: boolean,
): {
  client: PostgresQueryClient;
  queries: Array<{ sql: string; params?: Array<unknown> }>;
} => {
  const queries: Array<{ sql: string; params?: Array<unknown> }> = [];
  let firstCall = true;
  const client = {
    query: vi.fn(async (sql: string, params?: Array<unknown>) => {
      queries.push({ sql, params });
      if (firstCall) {
        firstCall = false;
        return { rows: [{ locked }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  } as unknown as PostgresQueryClient;
  return { client, queries };
};

// --- lock acquired ---

describe("withAdvisoryLock — lock acquired", () => {
  it("should call pg_try_advisory_lock with the given keys", async () => {
    const { client, queries } = makeClient(true);
    await withAdvisoryLock(client, KEY_1, KEY_2, async () => "ok");
    expect(queries[0].sql).toContain("pg_try_advisory_lock");
    expect(queries[0].params).toEqual([KEY_1, KEY_2]);
    expect(queries[0]).toMatchSnapshot();
  });

  it("should return the callback result when lock is acquired", async () => {
    const { client } = makeClient(true);
    const result = await withAdvisoryLock(
      client,
      KEY_1,
      KEY_2,
      async () => "callback-result",
    );
    expect(result).toBe("callback-result");
  });

  it("should release lock via pg_advisory_unlock after callback completes", async () => {
    const { client, queries } = makeClient(true);
    await withAdvisoryLock(client, KEY_1, KEY_2, async () => "done");
    const unlockQuery = queries.find((q) => q.sql.includes("pg_advisory_unlock"));
    expect(unlockQuery).toBeDefined();
    expect(unlockQuery!.params).toEqual([KEY_1, KEY_2]);
    expect(unlockQuery).toMatchSnapshot();
  });

  it("should release lock even when callback throws", async () => {
    const { client, queries } = makeClient(true);
    await expect(
      withAdvisoryLock(client, KEY_1, KEY_2, async () => {
        throw new Error("callback-error");
      }),
    ).rejects.toThrow("callback-error");
    const unlockQuery = queries.find((q) => q.sql.includes("pg_advisory_unlock"));
    expect(unlockQuery).toBeDefined();
  });

  it("should propagate the error from the callback", async () => {
    const { client } = makeClient(true);
    await expect(
      withAdvisoryLock(client, KEY_1, KEY_2, async () => {
        throw new Error("inner-error");
      }),
    ).rejects.toThrow("inner-error");
  });

  it("should execute exactly 2 queries (lock + unlock) when callback succeeds", async () => {
    const { client, queries } = makeClient(true);
    await withAdvisoryLock(client, KEY_1, KEY_2, async () => null);
    // query 0 = pg_try_advisory_lock, query 1 = pg_advisory_unlock (in finally)
    expect(queries).toHaveLength(2);
  });

  it("should work with async callback that returns a complex value", async () => {
    const { client } = makeClient(true);
    const result = await withAdvisoryLock(client, KEY_1, KEY_2, async () => ({
      count: 42,
      items: ["a", "b"],
    }));
    expect(result).toMatchSnapshot();
  });

  // P3: when fn() throws AND unlock throws, the fn() error is preserved (not the unlock error)
  it("should preserve fn() error when both fn() and unlock throw", async () => {
    const fnError = new Error("fn-error");
    const unlockError = new Error("unlock-error");

    const client: PostgresQueryClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("pg_try_advisory_lock")) {
          return { rows: [{ locked: true }], rowCount: 1 };
        }
        if (sql.includes("pg_advisory_unlock")) {
          throw unlockError;
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as PostgresQueryClient;

    const thrown = await withAdvisoryLock(client, KEY_1, KEY_2, async () => {
      throw fnError;
    }).catch((e: unknown) => e);

    expect(thrown).toBe(fnError);
    expect(thrown).not.toBe(unlockError);
  });

  // P3: when fn() succeeds AND unlock throws, the result is still returned (not an error)
  it("should return fn() result when fn() succeeds but unlock throws", async () => {
    const unlockError = new Error("unlock-error");

    const client: PostgresQueryClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("pg_try_advisory_lock")) {
          return { rows: [{ locked: true }], rowCount: 1 };
        }
        if (sql.includes("pg_advisory_unlock")) {
          throw unlockError;
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as PostgresQueryClient;

    const result = await withAdvisoryLock(
      client,
      KEY_1,
      KEY_2,
      async () => "success-value",
    );

    expect(result).toBe("success-value");
  });
});

// --- lock not acquired ---

describe("withAdvisoryLock — lock not acquired", () => {
  it("should return null when lock is not available", async () => {
    const { client } = makeClient(false);
    const result = await withAdvisoryLock(
      client,
      KEY_1,
      KEY_2,
      async () => "should-not-run",
    );
    expect(result).toBeNull();
  });

  it("should not call the callback when lock is not available", async () => {
    const { client } = makeClient(false);
    const cb = vi.fn(async () => "value");
    await withAdvisoryLock(client, KEY_1, KEY_2, cb);
    expect(cb).not.toHaveBeenCalled();
  });

  it("should not call pg_advisory_unlock when lock was not acquired", async () => {
    const { client, queries } = makeClient(false);
    await withAdvisoryLock(client, KEY_1, KEY_2, async () => "x");
    const unlockQuery = queries.find((q) => q.sql.includes("pg_advisory_unlock"));
    expect(unlockQuery).toBeUndefined();
  });

  it("should call exactly 1 query (only the try_lock) when lock is unavailable", async () => {
    const { client, queries } = makeClient(false);
    await withAdvisoryLock(client, KEY_1, KEY_2, async () => "x");
    expect(queries).toHaveLength(1);
  });

  it("should handle missing rows in result (treats as not locked)", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    } as unknown as PostgresQueryClient;
    const result = await withAdvisoryLock(client, KEY_1, KEY_2, async () => "x");
    expect(result).toBeNull();
  });

  it("should handle locked=false explicitly", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [{ locked: false }], rowCount: 1 }),
    } as unknown as PostgresQueryClient;
    const result = await withAdvisoryLock(client, KEY_1, KEY_2, async () => "x");
    expect(result).toBeNull();
  });
});

// --- different key pairs ---

describe("withAdvisoryLock — key handling", () => {
  it("should pass key1=0 and key2=0 correctly", async () => {
    const { client, queries } = makeClient(true);
    await withAdvisoryLock(client, 0, 0, async () => null);
    expect(queries[0].params).toEqual([0, 0]);
  });

  it("should pass large integer keys correctly", async () => {
    const { client, queries } = makeClient(true);
    const bigKey = 0x7fffffff;
    await withAdvisoryLock(client, bigKey, bigKey, async () => null);
    expect(queries[0].params).toEqual([bigKey, bigKey]);
    expect(queries[1].params).toEqual([bigKey, bigKey]);
  });
});
