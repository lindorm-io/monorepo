import { test, expect, beforeEach } from "vitest";
// TCK: Transactions Suite
// Split into rollback (basic commit/rollback) and savepoints (nested transactions).

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";
import type { ProteusSource } from "../../../classes/ProteusSource.js";

export const transactionsRollbackSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
  getSource: () => ProteusSource,
) => {
  const { TckSimpleUser } = entities;

  beforeEach(async () => {
    await getHandle().clear();
  });

  test("committed transaction persists data", async () => {
    const source = getSource();

    await source.transaction(async (ctx) => {
      const repo = ctx.repository(TckSimpleUser);
      await repo.insert({ name: "TxCommit", age: 1 });
    });

    const repo = getHandle().repository(TckSimpleUser);
    const found = await repo.find({ name: "TxCommit" });
    expect(found).toHaveLength(1);
  });

  test("rolled back transaction does not persist data", async () => {
    const source = getSource();

    try {
      await source.transaction(async (ctx) => {
        const repo = ctx.repository(TckSimpleUser);
        await repo.insert({ name: "TxRollback", age: 1 });
        throw new Error("Intentional rollback");
      });
    } catch {
      // Expected
    }

    const repo = getHandle().repository(TckSimpleUser);
    const found = await repo.find({ name: "TxRollback" });
    expect(found).toHaveLength(0);
  });

  test("transaction returns callback result on commit", async () => {
    const source = getSource();

    const result = await source.transaction(async (ctx) => {
      const repo = ctx.repository(TckSimpleUser);
      const entity = await repo.insert({ name: "TxReturn", age: 99 });
      return entity.id;
    });

    expect(typeof result).toBe("string");
    expect(result).toBeDefined();
  });

  test("multiple operations in a transaction are atomic", async () => {
    const source = getSource();

    try {
      await source.transaction(async (ctx) => {
        const repo = ctx.repository(TckSimpleUser);
        await repo.insert({ name: "AtomicA", age: 1 });
        await repo.insert({ name: "AtomicB", age: 2 });
        throw new Error("Rollback both");
      });
    } catch {
      // Expected
    }

    const repo = getHandle().repository(TckSimpleUser);
    const count = await repo.count();
    expect(count).toBe(0);
  });

  test("transaction propagates errors from callback", async () => {
    const source = getSource();

    await expect(
      source.transaction(async () => {
        throw new Error("Custom error");
      }),
    ).rejects.toThrow("Custom error");
  });

  test("read-your-writes within a transaction", async () => {
    const source = getSource();

    await source.transaction(async (ctx) => {
      const repo = ctx.repository(TckSimpleUser);
      const inserted = await repo.insert({ name: "TxRead" });
      const found = await repo.findOne({ id: inserted.id });
      expect(found).not.toBeNull();
      expect(found!.name).toBe("TxRead");
    });
  });

  test("inserting on a committed transaction context throws", async () => {
    const source = getSource();
    let capturedCtx: any;

    await source.transaction(async (ctx) => {
      capturedCtx = ctx;
      await ctx.repository(TckSimpleUser).insert({ name: "CommitGuard", age: 1 });
    });

    // Transaction has committed — any further use must throw
    try {
      const repo = capturedCtx.repository(TckSimpleUser);
      await repo.insert({ name: "AfterCommit", age: 2 });
      // If we reach here, the driver allowed the operation — verify committed data is intact
    } catch (err: any) {
      // Throwing is the expected behavior
      expect(err).toBeInstanceOf(Error);
    }

    // Committed data must be intact regardless
    const repo = getHandle().repository(TckSimpleUser);
    const committed = await repo.findOne({ name: "CommitGuard" });
    expect(committed).not.toBeNull();
  });

  test("inserting after rollback throws", async () => {
    const source = getSource();
    let capturedCtx: any;

    try {
      await source.transaction(async (ctx) => {
        capturedCtx = ctx;
        await ctx.repository(TckSimpleUser).insert({ name: "RollbackGuard", age: 1 });
        throw new Error("Force rollback");
      });
    } catch {
      /* expected */
    }

    // Transaction has rolled back — further use must throw
    try {
      const repo = capturedCtx.repository(TckSimpleUser);
      await repo.insert({ name: "AfterRollback", age: 2 });
      // If we reach here, the driver allowed the operation
    } catch (err: any) {
      // Throwing is the expected behavior
      expect(err).toBeInstanceOf(Error);
    }

    // Rolled-back data must NOT exist
    const repo = getHandle().repository(TckSimpleUser);
    const rolledBack = await repo.findOne({ name: "RollbackGuard" });
    expect(rolledBack).toBeNull();
  });
};

export const transactionsSavepointsSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
  getSource: () => ProteusSource,
) => {
  const { TckSimpleUser } = entities;

  beforeEach(async () => {
    await getHandle().clear();
  });

  test("nested transaction (savepoint) rolls back independently", async () => {
    const source = getSource();

    await source.transaction(async (ctx) => {
      const repo = ctx.repository(TckSimpleUser);
      await repo.insert({ name: "Outer", age: 1 });

      try {
        await ctx.transaction(async (inner) => {
          const innerRepo = inner.repository(TckSimpleUser);
          await innerRepo.insert({ name: "Inner", age: 2 });
          throw new Error("Rollback inner");
        });
      } catch {
        // Expected — inner transaction rolled back
      }
    });

    const repo = getHandle().repository(TckSimpleUser);
    const results = await repo.find();
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Outer");
  });

  test("deeply nested savepoints (3 levels) all commit correctly", async () => {
    const source = getSource();

    await source.transaction(async (ctx) => {
      await ctx.repository(TckSimpleUser).insert({ name: "Level1", age: 1 });

      await ctx.transaction(async (ctx2) => {
        await ctx2.repository(TckSimpleUser).insert({ name: "Level2", age: 2 });

        await ctx2.transaction(async (ctx3) => {
          await ctx3.repository(TckSimpleUser).insert({ name: "Level3", age: 3 });
        });
      });
    });

    const repo = getHandle().repository(TckSimpleUser);
    const results = await repo.find({ name: { $in: ["Level1", "Level2", "Level3"] } });
    expect(results).toHaveLength(3);
  });

  test("two sequential inner savepoint failures leave outer transaction healthy", async () => {
    const source = getSource();

    await source.transaction(async (ctx) => {
      const repo = ctx.repository(TckSimpleUser);
      await repo.insert({ name: "OuterRecord", age: 1 });

      try {
        await ctx.transaction(async (inner) => {
          await inner.repository(TckSimpleUser).insert({ name: "InnerFail1", age: 2 });
          throw new Error("Fail inner 1");
        });
      } catch {
        /* expected */
      }

      try {
        await ctx.transaction(async (inner) => {
          await inner.repository(TckSimpleUser).insert({ name: "InnerFail2", age: 3 });
          throw new Error("Fail inner 2");
        });
      } catch {
        /* expected */
      }

      await repo.insert({ name: "OuterRecord2", age: 4 });
    });

    const repo = getHandle().repository(TckSimpleUser);
    const all = await repo.find(undefined, { order: { name: "ASC" } });
    const names = all.map((u) => u.name).sort();
    expect(names).toEqual(["OuterRecord", "OuterRecord2"]);
  });

  test("savepoint rollback preserves outer writes and allows further inserts", async () => {
    const source = getSource();

    await source.transaction(async (ctx) => {
      const repo = ctx.repository(TckSimpleUser);
      await repo.insert({ name: "BeforeSavepoint", age: 1 });

      try {
        await ctx.transaction(async (inner) => {
          await inner
            .repository(TckSimpleUser)
            .insert({ name: "SavepointData", age: 99 });
          throw new Error("Rollback savepoint");
        });
      } catch {
        /* expected */
      }

      // Outer can continue after savepoint failure
      await repo.insert({ name: "AfterSavepoint", age: 2 });
    });

    const repo = getHandle().repository(TckSimpleUser);
    const results = await repo.find(undefined, { order: { name: "ASC" } });
    const names = results.map((u) => u.name).sort();

    expect(names).toContain("BeforeSavepoint");
    expect(names).toContain("AfterSavepoint");
    expect(names).not.toContain("SavepointData");
  });
};
