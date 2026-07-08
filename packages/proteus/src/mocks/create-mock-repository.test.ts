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
    const repo = createMockRepository(undefined, factory);

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

  describe("when seeded with rows", () => {
    type Row = { id: string; artistId?: string; year?: number };

    const rows: Row[] = [
      { id: "alb_1", artistId: "art_1", year: 1986 },
      { id: "alb_2", artistId: "art_1", year: 1988 },
      { id: "alb_3", artistId: "art_2", year: 1991 },
    ];

    test("findOne matches by predicate and returns null when absent", async () => {
      const repo = createMockRepository(rows);

      expect(await repo.findOne({ id: "alb_2" } as any)).toEqual(rows[1]);
      expect(await repo.findOne({ id: "nope" } as any)).toBeNull();
    });

    test("find filters by criteria and honours limit/offset", async () => {
      const repo = createMockRepository(rows);

      expect(await repo.find({ artistId: "art_1" } as any)).toEqual([rows[0], rows[1]]);
      expect(await repo.find(undefined, { offset: 1, limit: 1 } as any)).toEqual([
        rows[1],
      ]);
    });

    test("count / exists / findAndCount reflect the filtered rows", async () => {
      const repo = createMockRepository(rows);

      expect(await repo.count({ artistId: "art_1" } as any)).toBe(2);
      expect(await repo.exists({ artistId: "art_2" } as any)).toBe(true);
      expect(await repo.exists({ artistId: "nope" } as any)).toBe(false);
      expect(await repo.findAndCount({ artistId: "art_1" } as any)).toEqual([
        [rows[0], rows[1]],
        2,
      ]);
    });

    test("findPaginated pages, filters, and reports metadata", async () => {
      const repo = createMockRepository(rows);

      expect(
        await repo.findPaginated(undefined, { page: 1, pageSize: 2 } as any),
      ).toEqual({
        data: [rows[0], rows[1]],
        total: 3,
        page: 1,
        pageSize: 2,
        totalPages: 2,
        hasMore: true,
      });
      expect(await repo.findPaginated({ artistId: "art_1" } as any)).toEqual({
        data: [rows[0], rows[1]],
        total: 2,
        page: 1,
        pageSize: 10,
        totalPages: 1,
        hasMore: false,
      });
    });

    test("an empty seed serves empty results, not the factory echo", async () => {
      const repo = createMockRepository<Row>([]);

      expect(await repo.find({ id: "x" } as any)).toEqual([]);
      expect(await repo.findOne({ id: "x" } as any)).toBeNull();
      expect(await repo.count()).toBe(0);
    });

    test("seeded defaults remain overridable", async () => {
      const repo = createMockRepository(rows);
      repo.findOne.mockResolvedValueOnce({ id: "override" } as never);

      expect(await repo.findOne({ id: "alb_1" } as any)).toEqual({ id: "override" });
    });
  });
});
