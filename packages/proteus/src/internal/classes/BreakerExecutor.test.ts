import { CircuitOpenError as BreakerCircuitOpenError } from "@lindorm/breaker";
import {
  createMockCircuitBreaker,
  type MockCircuitBreaker,
} from "@lindorm/breaker/mocks";
import { CircuitOpenError } from "../../errors/CircuitOpenError";
import { BreakerExecutor } from "./BreakerExecutor";
import type { IRepositoryExecutor } from "../interfaces/RepositoryExecutor";
import type { IEntity } from "../../interfaces/Entity";

interface StubEntity extends IEntity {
  name: string;
}

const createMockExecutor = (): jest.Mocked<IRepositoryExecutor<StubEntity>> => ({
  executeInsert: jest.fn().mockResolvedValue({ id: "1", name: "inserted" }),
  executeUpdate: jest.fn().mockResolvedValue({ id: "1", name: "updated" }),
  executeDelete: jest.fn().mockResolvedValue(undefined),
  executeSoftDelete: jest.fn().mockResolvedValue(undefined),
  executeRestore: jest.fn().mockResolvedValue(undefined),
  executeDeleteExpired: jest.fn().mockResolvedValue(undefined),
  executeTtl: jest.fn().mockResolvedValue(3600),
  executeFind: jest.fn().mockResolvedValue([{ id: "1", name: "found" }]),
  executeCount: jest.fn().mockResolvedValue(5),
  executeExists: jest.fn().mockResolvedValue(true),
  executeIncrement: jest.fn().mockResolvedValue(undefined),
  executeDecrement: jest.fn().mockResolvedValue(undefined),
  executeInsertBulk: jest.fn().mockResolvedValue([{ id: "1", name: "bulk" }]),
  executeUpdateMany: jest.fn().mockResolvedValue(3),
});

describe("BreakerExecutor", () => {
  let inner: jest.Mocked<IRepositoryExecutor<StubEntity>>;
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
