import { createMockRepository } from "./vitest.js";
import { describe, expect, test, vi } from "vitest";

describe("createMockRepository", () => {
  test("should create a mock with all methods as vi.fn()", () => {
    const repo = createMockRepository();

    expect(repo).toMatchSnapshot();
  });

  test("should use default factory for create and query methods", async () => {
    const repo = createMockRepository();
    const criteria = { id: "test-1" };

    expect(repo.create({ name: "test" } as any)).toEqual({ name: "test" });
    expect(await repo.findOne(criteria as any)).toEqual(criteria);
    expect(await repo.find(criteria as any)).toEqual([criteria]);
    expect(await repo.findAndCount(criteria as any)).toEqual([[criteria], 1]);
  });

  test("should accept a custom factory", async () => {
    const factory = (opts: any) => ({ id: "custom", ...opts });
    const repo = createMockRepository(factory);

    expect(repo.create({ name: "hello" })).toEqual({ id: "custom", name: "hello" });
    expect(await repo.findOne({ name: "hello" } as any)).toEqual({
      id: "custom",
      name: "hello",
    });
  });

  test("should pass through entities for write methods", async () => {
    const repo = createMockRepository();
    const entity = { id: "test-1" };

    expect(await repo.insert(entity as any)).toBe(entity);
    expect(await repo.save(entity as any)).toBe(entity);
    expect(await repo.update(entity as any)).toBe(entity);
    expect(await repo.upsert(entity as any)).toBe(entity);
  });

  test("should return sensible defaults for scalar queries", async () => {
    const repo = createMockRepository();

    expect(await repo.count()).toBe(1);
    expect(await repo.exists({} as any)).toBe(true);
    expect(await repo.ttl({} as any)).toBe(60);
  });

  test("should return sensible defaults for aggregate methods", async () => {
    const repo = createMockRepository();

    expect(await repo.sum("id" as any)).toBeNull();
    expect(await repo.average("id" as any)).toBeNull();
    expect(await repo.minimum("id" as any)).toBeNull();
    expect(await repo.maximum("id" as any)).toBeNull();
  });

  test("should return sensible defaults for pagination methods", async () => {
    const repo = createMockRepository();

    expect(await repo.paginate()).toMatchSnapshot();
    expect(await repo.findPaginated()).toMatchSnapshot();
  });
});
