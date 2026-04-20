import type { IProteusQueryBuilder, IProteusRepository } from "../../../../interfaces";
import type { RedisTransactionHandle } from "../types/redis-types";
import { RedisDriverError } from "../errors/RedisDriverError";
import { RedisTransactionContext } from "./RedisTransactionContext";
import { describe, expect, test, vi } from "vitest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeHandle = (
  state: RedisTransactionHandle["state"] = "active",
): RedisTransactionHandle => ({
  state,
});

const makeDriver = () => ({
  commitTransaction: vi.fn().mockResolvedValue(undefined),
  rollbackTransaction: vi.fn().mockResolvedValue(undefined),
  createTransactionalQueryBuilder: vi
    .fn()
    .mockReturnValue({} as IProteusQueryBuilder<any>),
});

class StubEntity {}

// ─── constructor ──────────────────────────────────────────────────────────────

describe("RedisTransactionContext constructor", () => {
  test("constructs without a repository factory", () => {
    const handle = makeHandle();
    const driver = makeDriver();

    expect(() => new RedisTransactionContext(handle, driver as any)).not.toThrow();
  });

  test("constructs with a repository factory", () => {
    const handle = makeHandle();
    const driver = makeDriver();
    const factory = vi.fn();

    expect(
      () => new RedisTransactionContext(handle, driver as any, factory),
    ).not.toThrow();
  });
});

// ─── repository() ─────────────────────────────────────────────────────────────

describe("RedisTransactionContext.repository", () => {
  test("throws RedisDriverError when no factory is configured", () => {
    const ctx = new RedisTransactionContext(makeHandle(), makeDriver() as any);

    expect(() => ctx.repository(StubEntity as any)).toThrow(RedisDriverError);
    expect(() => ctx.repository(StubEntity as any)).toThrow(
      "Transactional repositories are not configured",
    );
  });

  test("delegates to the repository factory when configured", () => {
    const mockRepo = {} as IProteusRepository<any>;
    const factory = vi.fn().mockReturnValue(mockRepo);
    const ctx = new RedisTransactionContext(makeHandle(), makeDriver() as any, factory);

    const result = ctx.repository(StubEntity as any);

    expect(factory).toHaveBeenCalledWith(StubEntity);
    expect(result).toBe(mockRepo);
  });

  test("passes the target constructor to the factory", () => {
    class AnotherEntity {}

    const factory = vi.fn().mockReturnValue({});
    const ctx = new RedisTransactionContext(makeHandle(), makeDriver() as any, factory);

    ctx.repository(AnotherEntity as any);

    expect(factory).toHaveBeenCalledWith(AnotherEntity);
  });
});

// ─── queryBuilder() ───────────────────────────────────────────────────────────

describe("RedisTransactionContext.queryBuilder", () => {
  test("delegates to driver.createTransactionalQueryBuilder", () => {
    const handle = makeHandle();
    const driver = makeDriver();
    const ctx = new RedisTransactionContext(handle, driver as any);

    ctx.queryBuilder(StubEntity as any);

    expect(driver.createTransactionalQueryBuilder).toHaveBeenCalledWith(
      StubEntity,
      handle,
    );
  });

  test("returns the query builder from the driver", () => {
    const mockQb = { getMany: vi.fn() } as unknown as IProteusQueryBuilder<any>;
    const driver = makeDriver();
    driver.createTransactionalQueryBuilder.mockReturnValue(mockQb);
    const ctx = new RedisTransactionContext(makeHandle(), driver as any);

    const result = ctx.queryBuilder(StubEntity as any);

    expect(result).toBe(mockQb);
  });
});

// ─── transaction() (nested passthrough) ──────────────────────────────────────

describe("RedisTransactionContext.transaction (nested)", () => {
  test("executes the callback and returns its result", async () => {
    const ctx = new RedisTransactionContext(makeHandle(), makeDriver() as any);

    const result = await ctx.transaction(async (_inner) => "nested-result");

    expect(result).toBe("nested-result");
  });

  test("passes the same context instance to the callback (no savepoint)", async () => {
    const ctx = new RedisTransactionContext(makeHandle(), makeDriver() as any);
    let capturedCtx: RedisTransactionContext | undefined;

    await ctx.transaction(async (inner) => {
      capturedCtx = inner;
    });

    // Redis has no savepoints — nested tx receives the same context
    expect(capturedCtx).toBe(ctx);
  });

  test("propagates errors thrown inside the callback", async () => {
    const ctx = new RedisTransactionContext(makeHandle(), makeDriver() as any);

    await expect(
      ctx.transaction(async () => {
        throw new Error("inner failure");
      }),
    ).rejects.toThrow("inner failure");
  });

  test("supports deeply nested transactions without error", async () => {
    const ctx = new RedisTransactionContext(makeHandle(), makeDriver() as any);

    const result = await ctx.transaction(async (l1) =>
      l1.transaction(async (l2) => l2.transaction(async (_l3) => "deep")),
    );

    expect(result).toBe("deep");
  });
});

// ─── commit() ────────────────────────────────────────────────────────────────

describe("RedisTransactionContext.commit", () => {
  test("delegates to driver.commitTransaction with the handle", async () => {
    const handle = makeHandle();
    const driver = makeDriver();
    const ctx = new RedisTransactionContext(handle, driver as any);

    await ctx.commit();

    expect(driver.commitTransaction).toHaveBeenCalledTimes(1);
    expect(driver.commitTransaction).toHaveBeenCalledWith(handle);
  });

  test("resolves without throwing when driver commit succeeds", async () => {
    const ctx = new RedisTransactionContext(makeHandle(), makeDriver() as any);

    await expect(ctx.commit()).resolves.toBeUndefined();
  });

  test("propagates errors thrown by the driver", async () => {
    const driver = makeDriver();
    driver.commitTransaction.mockRejectedValue(
      new RedisDriverError("Cannot commit: transaction is committed"),
    );
    const ctx = new RedisTransactionContext(makeHandle("committed"), driver as any);

    await expect(ctx.commit()).rejects.toThrow(RedisDriverError);
    await expect(ctx.commit()).rejects.toThrow("Cannot commit: transaction is committed");
  });
});

// ─── rollback() ───────────────────────────────────────────────────────────────

describe("RedisTransactionContext.rollback", () => {
  test("delegates to driver.rollbackTransaction with the handle", async () => {
    const handle = makeHandle();
    const driver = makeDriver();
    const ctx = new RedisTransactionContext(handle, driver as any);

    await ctx.rollback();

    expect(driver.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(driver.rollbackTransaction).toHaveBeenCalledWith(handle);
  });

  test("resolves without throwing when driver rollback succeeds", async () => {
    const ctx = new RedisTransactionContext(makeHandle(), makeDriver() as any);

    await expect(ctx.rollback()).resolves.toBeUndefined();
  });

  test("propagates errors thrown by the driver", async () => {
    const driver = makeDriver();
    driver.rollbackTransaction.mockRejectedValue(
      new RedisDriverError("Cannot rollback: transaction is rolledBack"),
    );
    const ctx = new RedisTransactionContext(makeHandle("rolledBack"), driver as any);

    await expect(ctx.rollback()).rejects.toThrow(RedisDriverError);
    await expect(ctx.rollback()).rejects.toThrow(
      "Cannot rollback: transaction is rolledBack",
    );
  });
});
