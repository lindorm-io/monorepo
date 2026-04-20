import { PostgresTransactionError } from "../errors/PostgresTransactionError";
import type { PostgresTransactionHandle } from "../types/postgres-transaction-handle";
import { TransactionContext } from "./TransactionContext";
import { describe, expect, it, vi } from "vitest";

const makeHandle = (): PostgresTransactionHandle => {
  const queries: Array<string> = [];
  return {
    client: {
      query: vi.fn(async (sql: string, params?: Array<unknown>) => {
        queries.push(sql);
        return { rows: [{ id: 1 }], rowCount: 1 };
      }),
    },
    release: vi.fn(),
    state: "active" as const,
    savepointCounter: 0,
    __queries: queries,
  } as any;
};

describe("TransactionContext", () => {
  describe("repository", () => {
    it("should throw when no repository factory is configured", () => {
      const handle = makeHandle();
      const ctx = new TransactionContext(handle);

      expect(() => ctx.repository(class {} as any)).toThrow(PostgresTransactionError);
    });

    it("should return repository from factory when configured", () => {
      const handle = makeHandle();
      const mockRepo = {} as any;
      const factory = vi.fn().mockReturnValue(mockRepo);
      const ctx = new TransactionContext(handle, undefined, undefined, factory);

      class TestEntity {}
      const result = ctx.repository(TestEntity as any);

      expect(factory).toHaveBeenCalledWith(TestEntity);
      expect(result).toBe(mockRepo);
    });
  });

  describe("commit", () => {
    it("should issue COMMIT and release", async () => {
      const handle = makeHandle();
      const ctx = new TransactionContext(handle);

      await ctx.commit();

      expect(handle.state).toBe("committed");
      expect(handle.release).toHaveBeenCalled();
    });

    it("should throw when already committed", async () => {
      const handle = makeHandle();
      const ctx = new TransactionContext(handle);

      await ctx.commit();

      await expect(ctx.commit()).rejects.toThrow(PostgresTransactionError);
    });
  });

  describe("rollback", () => {
    it("should issue ROLLBACK and release", async () => {
      const handle = makeHandle();
      const ctx = new TransactionContext(handle);

      await ctx.rollback();

      expect(handle.state).toBe("rolledback");
      expect(handle.release).toHaveBeenCalled();
    });

    it("should throw when already rolledback", async () => {
      const handle = makeHandle();
      const ctx = new TransactionContext(handle);

      await ctx.rollback();

      await expect(ctx.rollback()).rejects.toThrow(PostgresTransactionError);
    });
  });

  describe("cross-state transitions", () => {
    it("should throw when committing after rollback", async () => {
      const handle = makeHandle();
      const ctx = new TransactionContext(handle);
      await ctx.rollback();
      await expect(ctx.commit()).rejects.toThrow(PostgresTransactionError);
    });

    it("should throw when rolling back after commit", async () => {
      const handle = makeHandle();
      const ctx = new TransactionContext(handle);
      await ctx.commit();
      await expect(ctx.rollback()).rejects.toThrow(PostgresTransactionError);
    });
  });

  describe("transaction (savepoint nesting)", () => {
    it("should create a savepoint for nested transaction", async () => {
      const handle = makeHandle();
      const ctx = new TransactionContext(handle);

      const result = await ctx.transaction(async () => {
        return "nested-ok";
      });

      const queries = (handle as any).__queries as Array<string>;
      expect(queries).toEqual(['SAVEPOINT "sp_1"', 'RELEASE SAVEPOINT "sp_1"']);
      expect(result).toBe("nested-ok");
    });

    it("should rollback savepoint on nested error", async () => {
      const handle = makeHandle();
      const ctx = new TransactionContext(handle);

      await expect(
        ctx.transaction(async () => {
          throw new Error("nested boom");
        }),
      ).rejects.toThrow("nested boom");

      const queries = (handle as any).__queries as Array<string>;
      expect(queries).toEqual(['SAVEPOINT "sp_1"', 'ROLLBACK TO SAVEPOINT "sp_1"']);
    });

    it("should support double nesting", async () => {
      const handle = makeHandle();
      const ctx = new TransactionContext(handle);

      await ctx.transaction(async (innerCtx) => {
        await innerCtx.transaction(async () => {});
      });

      const queries = (handle as any).__queries as Array<string>;
      expect(queries).toEqual([
        'SAVEPOINT "sp_1"',
        'SAVEPOINT "sp_2"',
        'RELEASE SAVEPOINT "sp_2"',
        'RELEASE SAVEPOINT "sp_1"',
      ]);
    });

    it("should throw when nesting transaction after commit", async () => {
      const handle = makeHandle();
      const ctx = new TransactionContext(handle);
      await ctx.commit();
      await expect(ctx.transaction(async () => {})).rejects.toThrow(
        PostgresTransactionError,
      );
    });

    it("should throw when nesting transaction after rollback", async () => {
      const handle = makeHandle();
      const ctx = new TransactionContext(handle);
      await ctx.rollback();
      await expect(ctx.transaction(async () => {})).rejects.toThrow(
        PostgresTransactionError,
      );
    });

    it("should allow outer commit after nested savepoint failure", async () => {
      const handle = makeHandle();
      const ctx = new TransactionContext(handle);

      try {
        await ctx.transaction(async () => {
          throw new Error("inner fail");
        });
      } catch {
        // Savepoint rolled back, outer transaction still active
      }

      await ctx.commit();

      expect(handle.state).toBe("committed");
      const queries = (handle as any).__queries as Array<string>;
      expect(queries).toMatchSnapshot();
    });
  });
});
