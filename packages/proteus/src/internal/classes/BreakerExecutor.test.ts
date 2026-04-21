import { CircuitOpenError as BreakerCircuitOpenError } from "@lindorm/breaker";
import { createMockCircuitBreaker } from "@lindorm/breaker/mocks/vitest";
import { beforeEach, describe, expect, it, vi, type Mocked } from "vitest";
import { CircuitOpenError } from "../../errors/CircuitOpenError.js";
import { BreakerExecutor } from "./BreakerExecutor.js";
import type { IRepositoryExecutor } from "../interfaces/RepositoryExecutor.js";
import type { IEntity } from "../../interfaces/Entity.js";

interface StubEntity extends IEntity {
  name: string;
}

const createMockExecutor = (): Mocked<IRepositoryExecutor<StubEntity>> => ({
  executeInsert: vi.fn().mockResolvedValue({ id: "1", name: "inserted" }),
  executeUpdate: vi.fn().mockResolvedValue({ id: "1", name: "updated" }),
  executeDelete: vi.fn().mockResolvedValue(undefined),
  executeSoftDelete: vi.fn().mockResolvedValue(undefined),
  executeRestore: vi.fn().mockResolvedValue(undefined),
  executeDeleteExpired: vi.fn().mockResolvedValue(undefined),
  executeTtl: vi.fn().mockResolvedValue(3600),
  executeFind: vi.fn().mockResolvedValue([{ id: "1", name: "found" }]),
  executeCount: vi.fn().mockResolvedValue(5),
  executeExists: vi.fn().mockResolvedValue(true),
  executeIncrement: vi.fn().mockResolvedValue(undefined),
  executeDecrement: vi.fn().mockResolvedValue(undefined),
  executeInsertBulk: vi.fn().mockResolvedValue([{ id: "1", name: "bulk" }]),
  executeUpdateMany: vi.fn().mockResolvedValue(3),
});

describe("BreakerExecutor", () => {
  let inner: Mocked<IRepositoryExecutor<StubEntity>>;
  let breaker: ReturnType<typeof createMockCircuitBreaker>;
  let executor: BreakerExecutor<StubEntity>;

  beforeEach(() => {
    inner = createMockExecutor();
    breaker = createMockCircuitBreaker();
    executor = new BreakerExecutor(inner, breaker);
  });

  describe("delegation through breaker.execute", () => {
    it("should delegate executeInsert", async () => {
      const entity = { id: "1", name: "test" } as StubEntity;
      const result = await executor.executeInsert(entity);

      expect(breaker.execute).toHaveBeenCalledTimes(1);
      expect(inner.executeInsert).toHaveBeenCalledWith(entity);
      expect(result).toMatchSnapshot();
    });

    it("should delegate executeUpdate", async () => {
      const entity = { id: "1", name: "test" } as StubEntity;
      const result = await executor.executeUpdate(entity);

      expect(breaker.execute).toHaveBeenCalledTimes(1);
      expect(inner.executeUpdate).toHaveBeenCalledWith(entity);
      expect(result).toMatchSnapshot();
    });

    it("should delegate executeDelete", async () => {
      const criteria = { id: "1" } as any;
      const options = { limit: 10 };
      await executor.executeDelete(criteria, options);

      expect(breaker.execute).toHaveBeenCalledTimes(1);
      expect(inner.executeDelete).toHaveBeenCalledWith(criteria, options);
    });

    it("should delegate executeSoftDelete", async () => {
      const criteria = { id: "1" } as any;
      await executor.executeSoftDelete(criteria);

      expect(breaker.execute).toHaveBeenCalledTimes(1);
      expect(inner.executeSoftDelete).toHaveBeenCalledWith(criteria);
    });

    it("should delegate executeRestore", async () => {
      const criteria = { id: "1" } as any;
      await executor.executeRestore(criteria);

      expect(breaker.execute).toHaveBeenCalledTimes(1);
      expect(inner.executeRestore).toHaveBeenCalledWith(criteria);
    });

    it("should delegate executeDeleteExpired", async () => {
      await executor.executeDeleteExpired();

      expect(breaker.execute).toHaveBeenCalledTimes(1);
      expect(inner.executeDeleteExpired).toHaveBeenCalled();
    });

    it("should delegate executeTtl", async () => {
      const criteria = { id: "1" } as any;
      const result = await executor.executeTtl(criteria);

      expect(breaker.execute).toHaveBeenCalledTimes(1);
      expect(inner.executeTtl).toHaveBeenCalledWith(criteria);
      expect(result).toMatchSnapshot();
    });

    it("should delegate executeFind", async () => {
      const criteria = { name: "test" } as any;
      const options = { limit: 10 } as any;
      const scope = {} as any;
      const result = await executor.executeFind(criteria, options, scope);

      expect(breaker.execute).toHaveBeenCalledTimes(1);
      expect(inner.executeFind).toHaveBeenCalledWith(criteria, options, scope);
      expect(result).toMatchSnapshot();
    });

    it("should delegate executeCount", async () => {
      const criteria = { name: "test" } as any;
      const options = {} as any;
      const result = await executor.executeCount(criteria, options);

      expect(breaker.execute).toHaveBeenCalledTimes(1);
      expect(inner.executeCount).toHaveBeenCalledWith(criteria, options);
      expect(result).toMatchSnapshot();
    });

    it("should delegate executeExists", async () => {
      const criteria = { id: "1" } as any;
      const result = await executor.executeExists(criteria);

      expect(breaker.execute).toHaveBeenCalledTimes(1);
      expect(inner.executeExists).toHaveBeenCalledWith(criteria);
      expect(result).toMatchSnapshot();
    });

    it("should delegate executeIncrement", async () => {
      const criteria = { id: "1" } as any;
      await executor.executeIncrement(criteria, "name" as keyof StubEntity, 1);

      expect(breaker.execute).toHaveBeenCalledTimes(1);
      expect(inner.executeIncrement).toHaveBeenCalledWith(criteria, "name", 1);
    });

    it("should delegate executeDecrement", async () => {
      const criteria = { id: "1" } as any;
      await executor.executeDecrement(criteria, "name" as keyof StubEntity, 1);

      expect(breaker.execute).toHaveBeenCalledTimes(1);
      expect(inner.executeDecrement).toHaveBeenCalledWith(criteria, "name", 1);
    });

    it("should delegate executeInsertBulk", async () => {
      const entities = [{ id: "1", name: "a" }] as Array<StubEntity>;
      const result = await executor.executeInsertBulk(entities);

      expect(breaker.execute).toHaveBeenCalledTimes(1);
      expect(inner.executeInsertBulk).toHaveBeenCalledWith(entities);
      expect(result).toMatchSnapshot();
    });

    it("should delegate executeUpdateMany", async () => {
      const criteria = { name: "old" } as any;
      const update = { name: "new" } as any;
      const options = { systemFilters: false };
      const result = await executor.executeUpdateMany(criteria, update, options);

      expect(breaker.execute).toHaveBeenCalledTimes(1);
      expect(inner.executeUpdateMany).toHaveBeenCalledWith(criteria, update, options);
      expect(result).toMatchSnapshot();
    });
  });

  describe("error handling", () => {
    it("should re-throw BreakerCircuitOpenError as proteus CircuitOpenError", async () => {
      const breakerError = new BreakerCircuitOpenError("Circuit is open");
      breaker.execute.mockRejectedValueOnce(breakerError);

      const error = await executor
        .executeInsert({ id: "1", name: "test" } as StubEntity)
        .catch((e: Error) => e);

      expect(error).toBeInstanceOf(CircuitOpenError);
      expect(error).not.toBeInstanceOf(BreakerCircuitOpenError);
      expect(error).toMatchSnapshot();
    });

    it("should pass through non-breaker errors unchanged", async () => {
      const originalError = new Error("some database error");
      breaker.execute.mockRejectedValueOnce(originalError);

      const error = await executor
        .executeInsert({ id: "1", name: "test" } as StubEntity)
        .catch((e: Error) => e);

      expect(error).toBe(originalError);
      expect(error.message).toBe("some database error");
    });

    it("should pass through TypeError unchanged", async () => {
      const originalError = new TypeError("invalid argument");
      breaker.execute.mockRejectedValueOnce(originalError);

      const error = await executor
        .executeInsert({ id: "1", name: "test" } as StubEntity)
        .catch((e: Error) => e);

      expect(error).toBe(originalError);
    });
  });
});
