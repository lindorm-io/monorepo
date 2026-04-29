import type { PostgresTransactionHandle } from "../../types/postgres-transaction-handle.js";
import { withSavepoint } from "./with-savepoint.js";
import { describe, expect, it, vi } from "vitest";

const makeHandle = (): PostgresTransactionHandle => {
  const queries: Array<string> = [];
  return {
    client: {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        return { rows: [], rowCount: 0 };
      }),
    },
    release: vi.fn(),
    state: "active",
    savepointCounter: 0,
    __queries: queries,
  } as any;
};

describe("withSavepoint", () => {
  it("should create savepoint, run fn, and release savepoint on success", async () => {
    const handle = makeHandle();

    const result = await withSavepoint(handle, async () => "ok");

    const queries = (handle as any).__queries as Array<string>;
    expect(queries).toEqual(['SAVEPOINT "sp_1"', 'RELEASE SAVEPOINT "sp_1"']);
    expect(result).toBe("ok");
  });

  it("should rollback to savepoint on error and rethrow", async () => {
    const handle = makeHandle();

    await expect(
      withSavepoint(handle, async () => {
        throw new Error("inner failure");
      }),
    ).rejects.toThrow("inner failure");

    const queries = (handle as any).__queries as Array<string>;
    expect(queries).toEqual(['SAVEPOINT "sp_1"', 'ROLLBACK TO SAVEPOINT "sp_1"']);
  });

  it("should preserve original error and attach rollback error as cause when rollback also fails", async () => {
    const rollbackError = new Error("rollback failed");

    // Override query so the rollback SQL throws
    const handle: PostgresTransactionHandle = {
      client: {
        query: vi.fn(async (sql: string) => {
          if (sql.startsWith("ROLLBACK TO SAVEPOINT")) {
            throw rollbackError;
          }
          return { rows: [], rowCount: 0 };
        }),
      } as any,
      release: vi.fn(),
      state: "active",
      savepointCounter: 0,
    };

    const originalError = new Error("original failure");

    const thrown = await withSavepoint(handle, async () => {
      throw originalError;
    }).catch((e: unknown) => e);

    // The original error should be rethrown
    expect(thrown).toBe(originalError);
    // The rollback error should be attached as the cause
    expect((thrown as Error).cause).toBe(rollbackError);
  });

  it("should support nested savepoints with incrementing counters", async () => {
    const handle = makeHandle();

    await withSavepoint(handle, async () => {
      await withSavepoint(handle, async () => "inner");
      return "outer";
    });

    const queries = (handle as any).__queries as Array<string>;
    expect(queries).toEqual([
      'SAVEPOINT "sp_1"',
      'SAVEPOINT "sp_2"',
      'RELEASE SAVEPOINT "sp_2"',
      'RELEASE SAVEPOINT "sp_1"',
    ]);
    expect(handle.savepointCounter).toBe(2);
  });

  // P3: when fn() succeeds but releaseSavepoint throws, the successful result is still returned
  it("should return fn() result when releaseSavepoint throws", async () => {
    const releaseError = new Error("release failed");

    const handle: PostgresTransactionHandle = {
      client: {
        query: vi.fn(async (sql: string) => {
          if (sql.startsWith("RELEASE SAVEPOINT")) {
            throw releaseError;
          }
          return { rows: [], rowCount: 0 };
        }),
      } as any,
      release: vi.fn(),
      state: "active",
      savepointCounter: 0,
    };

    const result = await withSavepoint(handle, async () => "success-value");

    expect(result).toBe("success-value");
  });

  it("should rollback inner savepoint while releasing outer on partial failure", async () => {
    const handle = makeHandle();

    await withSavepoint(handle, async () => {
      try {
        await withSavepoint(handle, async () => {
          throw new Error("inner boom");
        });
      } catch {
        // swallow inner error
      }
      return "outer ok";
    });

    const queries = (handle as any).__queries as Array<string>;
    expect(queries).toEqual([
      'SAVEPOINT "sp_1"',
      'SAVEPOINT "sp_2"',
      'ROLLBACK TO SAVEPOINT "sp_2"',
      'RELEASE SAVEPOINT "sp_1"',
    ]);
  });
});
