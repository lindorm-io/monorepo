import type { PostgresQueryClient } from "../types/postgres-query-client.js";
import { withAdvisoryXactLock } from "./advisory-xact-lock.js";
import { describe, expect, it, vi } from "vitest";

const KEY_1 = 0x50474558; // "PGEX"
const KEY_2 = 0x53594e43; // "SYNC"

const makeClient = (): {
  client: PostgresQueryClient;
  queries: Array<{ sql: string; params?: Array<unknown> }>;
} => {
  const queries: Array<{ sql: string; params?: Array<unknown> }> = [];
  const client: PostgresQueryClient = {
    query: vi.fn(async (sql: string, params?: Array<unknown>) => {
      queries.push({ sql, params });
      return { rows: [], rowCount: 0 };
    }),
  };
  return { client, queries };
};

describe("withAdvisoryXactLock", () => {
  it("should acquire the transaction-scoped lock with the given keys", async () => {
    const { client, queries } = makeClient();
    await withAdvisoryXactLock(client, KEY_1, KEY_2, async () => "ok");
    expect(queries[0].sql).toContain("pg_advisory_xact_lock");
    expect(queries[0].params).toEqual([KEY_1, KEY_2]);
    expect(queries[0]).toMatchSnapshot();
  });

  it("should acquire the lock before running the callback", async () => {
    const { client, queries } = makeClient();
    await withAdvisoryXactLock(client, KEY_1, KEY_2, async () => {
      await client.query("GUARDED_SQL;");
    });
    expect(queries.map((q) => q.sql)).toMatchSnapshot();
  });

  it("should return the callback result", async () => {
    const { client } = makeClient();
    const result = await withAdvisoryXactLock(client, KEY_1, KEY_2, async () => 42);
    expect(result).toBe(42);
  });

  it("should propagate the callback error", async () => {
    const { client } = makeClient();
    await expect(
      withAdvisoryXactLock(client, KEY_1, KEY_2, async () => {
        throw new Error("callback-error");
      }),
    ).rejects.toThrow("callback-error");
  });

  it("should never unlock — the transaction owns the lock lifetime", async () => {
    const { client, queries } = makeClient();
    await withAdvisoryXactLock(client, KEY_1, KEY_2, async () => null);
    expect(queries.some((q) => q.sql.includes("unlock"))).toBe(false);
  });

  it("should not run the callback when lock acquisition fails", async () => {
    const client: PostgresQueryClient = {
      query: vi.fn(async () => {
        throw new Error("lock-error");
      }),
    };
    const callback = vi.fn(async () => "value");
    await expect(withAdvisoryXactLock(client, KEY_1, KEY_2, callback)).rejects.toThrow(
      "lock-error",
    );
    expect(callback).not.toHaveBeenCalled();
  });
});
