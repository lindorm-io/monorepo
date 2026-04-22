import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  CreateDateField,
  Entity,
  Field,
  PrimaryKeyField,
  UpdateDateField,
  VersionField,
} from "../../../../decorators/index.js";
import { ProteusSource } from "../../../../classes/ProteusSource.js";
import { MemoryDriverError } from "../errors/MemoryDriverError.js";
import type { IProteusRepository } from "../../../../interfaces/index.js";

// ─── Entities ─────────────────────────────────────────────────────────────────

@Entity({ name: "TxCtxUser" })
class TxCtxUser {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let source: ProteusSource;
let repo: IProteusRepository<TxCtxUser>;

beforeAll(async () => {
  source = new ProteusSource({
    driver: "memory",
    entities: [TxCtxUser],
    logger: createMockLogger(),
  });
  await source.connect();
  await source.setup();

  repo = source.repository(TxCtxUser);
});

afterAll(async () => {
  await source.disconnect();
});

beforeEach(async () => {
  await repo.clear();
});

// ─── repository() ─────────────────────────────────────────────────────────────

describe("MemoryTransactionContext.repository", () => {
  test("returns a transactional repository that scopes writes to the transaction", async () => {
    await source.transaction(async (ctx) => {
      const txRepo = ctx.repository(TxCtxUser);
      await txRepo.insert(txRepo.create({ name: "InTx" }));

      // Should be visible inside the transaction
      const inside = await txRepo.find();
      expect(inside).toHaveLength(1);
      expect(inside[0].name).toBe("InTx");
    });

    // Should be visible after commit
    const after = await repo.find();
    expect(after).toHaveLength(1);
  });

  test("throws MemoryDriverError when no repoFactory is configured", async () => {
    const driver = (source as any)._driver;
    const handle = await driver.beginTransaction();

    // Construct a context with no factory
    const { MemoryTransactionContext } = await import("./MemoryTransactionContext.js");
    const ctx = new MemoryTransactionContext(handle, driver);

    expect(() => ctx.repository(TxCtxUser)).toThrow(MemoryDriverError);
    expect(() => ctx.repository(TxCtxUser)).toThrow(
      "Transactional repositories are not configured",
    );

    await driver.rollbackTransaction(handle);
  });
});

// ─── queryBuilder() ───────────────────────────────────────────────────────────

describe("MemoryTransactionContext.queryBuilder", () => {
  test("returns a query builder scoped to the transaction store", async () => {
    let qbResult: TxCtxUser[] = [];

    await source.transaction(async (ctx) => {
      const txRepo = ctx.repository(TxCtxUser);
      await txRepo.insert(txRepo.create({ name: "QbInTx" }));

      const qb = ctx.queryBuilder(TxCtxUser);
      qbResult = await qb.getMany();
    });

    expect(qbResult).toHaveLength(1);
    expect(qbResult[0].name).toBe("QbInTx");
  });

  test("query builder does not see uncommitted writes from another transaction", async () => {
    // Start two independent transactions; each should see only its own writes
    const driver = (source as any)._driver;

    const handleA = await driver.beginTransaction();
    const handleB = await driver.beginTransaction();

    const { MemoryTransactionContext } = await import("./MemoryTransactionContext.js");
    const ctxA = new MemoryTransactionContext(handleA, driver, (t: any) =>
      driver.createTransactionalRepository(t, handleA),
    );
    const ctxB = new MemoryTransactionContext(handleB, driver, (t: any) =>
      driver.createTransactionalRepository(t, handleB),
    );

    const repoA = ctxA.repository(TxCtxUser);
    await repoA.insert(repoA.create({ name: "FromA" }));

    const qbB = ctxB.queryBuilder(TxCtxUser);
    const resultB = await qbB.getMany();

    expect(resultB).toHaveLength(0);

    await driver.rollbackTransaction(handleA);
    await driver.rollbackTransaction(handleB);
  });
});

// ─── client() ─────────────────────────────────────────────────────────────────

describe("MemoryTransactionContext.client", () => {
  test("returns the transaction-scoped MemoryStore", async () => {
    const driver = (source as any)._driver;
    const handle = await driver.beginTransaction();

    const { MemoryTransactionContext } = await import("./MemoryTransactionContext.js");
    const ctx = new MemoryTransactionContext(handle, driver);

    const client = await ctx.client<typeof handle.store>();

    expect(client).toBe(handle.store);
    expect(client.tables).toBeInstanceOf(Map);

    await driver.rollbackTransaction(handle);
  });
});

// ─── transaction() (nested savepoints) ───────────────────────────────────────

describe("MemoryTransactionContext.transaction (nested)", () => {
  test("nested success: inner changes survive", async () => {
    await source.transaction(async (ctx) => {
      const outer = ctx.repository(TxCtxUser);
      await outer.insert(outer.create({ name: "Outer" }));

      await ctx.transaction(async (innerCtx) => {
        const inner = innerCtx.repository(TxCtxUser);
        await inner.insert(inner.create({ name: "Inner" }));
      });
    });

    const all = await repo.find();
    expect(all).toHaveLength(2);
    expect(all.map((u) => u.name).sort()).toMatchSnapshot();
  });

  test("nested failure: inner changes rolled back, outer changes survive", async () => {
    await source.transaction(async (ctx) => {
      const outer = ctx.repository(TxCtxUser);
      await outer.insert(outer.create({ name: "OuterSurvives" }));

      await expect(
        ctx.transaction(async (innerCtx) => {
          const inner = innerCtx.repository(TxCtxUser);
          await inner.insert(inner.create({ name: "InnerRolledBack" }));
          throw new Error("force inner rollback");
        }),
      ).rejects.toThrow("force inner rollback");

      // After inner rollback, outer changes should still be in place
      const remaining = await outer.find();
      expect(remaining.some((u) => u.name === "OuterSurvives")).toBe(true);
      expect(remaining.some((u) => u.name === "InnerRolledBack")).toBe(false);
    });

    // Only outer survived
    const final = await repo.find();
    expect(final).toHaveLength(1);
    expect(final[0].name).toBe("OuterSurvives");
  });
});

// ─── commit() / rollback() ────────────────────────────────────────────────────

describe("MemoryTransactionContext.commit / rollback", () => {
  test("explicit commit applies writes to main store", async () => {
    const driver = (source as any)._driver;
    const handle = await driver.beginTransaction();

    const { MemoryTransactionContext } = await import("./MemoryTransactionContext.js");
    const ctx = new MemoryTransactionContext(handle, driver, (t: any) =>
      driver.createTransactionalRepository(t, handle),
    );

    const txRepo = ctx.repository(TxCtxUser);
    await txRepo.insert(txRepo.create({ name: "ExplicitCommit" }));

    await ctx.commit();

    const results = await repo.find();
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("ExplicitCommit");
  });

  test("explicit rollback discards writes", async () => {
    const driver = (source as any)._driver;
    const handle = await driver.beginTransaction();

    const { MemoryTransactionContext } = await import("./MemoryTransactionContext.js");
    const ctx = new MemoryTransactionContext(handle, driver, (t: any) =>
      driver.createTransactionalRepository(t, handle),
    );

    const txRepo = ctx.repository(TxCtxUser);
    await txRepo.insert(txRepo.create({ name: "WillBeDiscarded" }));

    await ctx.rollback();

    const results = await repo.find();
    expect(results).toHaveLength(0);
  });
});
