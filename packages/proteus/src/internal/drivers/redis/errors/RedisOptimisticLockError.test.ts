import MockDate from "mockdate";
import { LindormError } from "@lindorm/errors";
import { ProteusError } from "../../../../errors/ProteusError";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError";
import { RedisOptimisticLockError } from "./RedisOptimisticLockError";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const FIXED_DATE = new Date("2024-01-01T00:00:00.000Z");

beforeAll(() => {
  MockDate.set(FIXED_DATE);
});

afterAll(() => {
  MockDate.reset();
});

// ─── instanceof ───────────────────────────────────────────────────────────────

describe("RedisOptimisticLockError instanceof", () => {
  test("is an instance of Error", () => {
    expect(new RedisOptimisticLockError("User", { id: "abc" })).toBeInstanceOf(Error);
  });

  test("is an instance of LindormError", () => {
    expect(new RedisOptimisticLockError("User", { id: "abc" })).toBeInstanceOf(
      LindormError,
    );
  });

  test("is an instance of ProteusError", () => {
    expect(new RedisOptimisticLockError("User", { id: "abc" })).toBeInstanceOf(
      ProteusError,
    );
  });

  test("is an instance of ProteusRepositoryError", () => {
    expect(new RedisOptimisticLockError("User", { id: "abc" })).toBeInstanceOf(
      ProteusRepositoryError,
    );
  });

  test("is an instance of RedisOptimisticLockError", () => {
    expect(new RedisOptimisticLockError("User", { id: "abc" })).toBeInstanceOf(
      RedisOptimisticLockError,
    );
  });
});

// ─── name property ────────────────────────────────────────────────────────────

describe("RedisOptimisticLockError name", () => {
  test("has the correct name property", () => {
    expect(new RedisOptimisticLockError("User", { id: "abc" }).name).toBe(
      "OptimisticLockError",
    );
  });
});

// ─── message ──────────────────────────────────────────────────────────────────

describe("RedisOptimisticLockError message", () => {
  test("includes the entity name in the message", () => {
    const error = new RedisOptimisticLockError("User", { id: "abc" });
    expect(error.message).toBe('Optimistic lock failed for "User"');
  });

  test("formats message correctly for different entity names", () => {
    const error = new RedisOptimisticLockError("Order", { orderId: 42 });
    expect(error.message).toBe('Optimistic lock failed for "Order"');
  });
});

// ─── debug metadata ───────────────────────────────────────────────────────────

describe("RedisOptimisticLockError debug metadata", () => {
  test("stores entityName and primaryKey in debug field", () => {
    const primaryKey = { id: "abc-123" };
    const error = new RedisOptimisticLockError("User", primaryKey);

    expect(error.debug).toEqual({ entityName: "User", primaryKey: { id: "abc-123" } });
  });

  test("stores composite primary key in debug field", () => {
    const primaryKey = { tenantId: "t-1", userId: "u-2" };
    const error = new RedisOptimisticLockError("TenantUser", primaryKey);

    expect(error.debug).toEqual({ entityName: "TenantUser", primaryKey });
  });
});

// ─── snapshot ─────────────────────────────────────────────────────────────────

describe("RedisOptimisticLockError snapshot", () => {
  test("serialises to JSON with expected shape", () => {
    // Construct with a known id via a workaround: instantiate and override id
    // using the fixed approach — LindormError does not expose id override in
    // the custom constructor, so we verify the stable fields via expect.objectContaining
    const error = new RedisOptimisticLockError("User", { id: "abc-123" });

    expect({
      message: error.message,
      name: error.name,
      debug: error.debug,
      code: error.code,
      status: error.status,
      timestamp: error.timestamp,
    }).toMatchSnapshot();
  });

  test("matches snapshot for composite primary key", () => {
    const error = new RedisOptimisticLockError("Order", {
      orderId: 99,
      tenantId: "t-42",
    });

    expect({
      message: error.message,
      name: error.name,
      debug: error.debug,
      code: error.code,
      status: error.status,
      timestamp: error.timestamp,
    }).toMatchSnapshot();
  });
});
