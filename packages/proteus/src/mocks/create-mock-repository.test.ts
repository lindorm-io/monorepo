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

  describe("when seeded — writes persist", () => {
    type Row = { id?: string; name?: string; count?: number };

    test("insert persists and findOne round-trips (generated id)", async () => {
      const repo = createMockRepository<Row>([]);

      const inserted = await repo.insert({ name: "hello" } as any);
      expect(inserted.id).toEqual(expect.any(String));

      const found = await repo.findOne({ id: inserted.id } as any);
      expect(found).toEqual({ id: inserted.id, name: "hello" });
    });

    test("insert honours a provided id and does not mutate the caller's input", async () => {
      const repo = createMockRepository<Row>([]);
      const input = { id: "row_1", name: "kept" };

      const inserted = await repo.insert(input as any);
      expect(inserted).not.toBe(input);
      expect(await repo.findOne({ id: "row_1" } as any)).toEqual(input);
    });

    test("insert accepts an array and returns each stored row", async () => {
      const repo = createMockRepository<Row>([]);

      const result = await repo.insert([{ name: "a" }, { name: "b" }] as any);
      expect(result).toHaveLength(2);
      expect(await repo.count()).toBe(2);
    });

    test("save / upsert update in place by id, else insert", async () => {
      const repo = createMockRepository<Row>([{ id: "row_1", name: "old" }]);

      expect(await repo.save({ id: "row_1", name: "new" } as any)).toEqual({
        id: "row_1",
        name: "new",
      });
      expect(await repo.count()).toBe(1);

      const created = await repo.upsert({ name: "fresh" } as any);
      expect(created.id).toEqual(expect.any(String));
      expect(await repo.count()).toBe(2);
    });

    test("update merges onto the stored row", async () => {
      const repo = createMockRepository<Row>([{ id: "row_1", name: "old", count: 1 }]);

      const updated = await repo.update({ id: "row_1", name: "new" } as any);
      expect(updated).toEqual({ id: "row_1", name: "new", count: 1 });
    });

    test("destroy / delete remove matching rows", async () => {
      const repo = createMockRepository<Row>([
        { id: "row_1", name: "a" },
        { id: "row_2", name: "b" },
        { id: "row_3", name: "b" },
      ]);

      await repo.destroy({ id: "row_1" } as any);
      expect(await repo.findOne({ id: "row_1" } as any)).toBeNull();

      await repo.delete({ name: "b" } as any);
      expect(await repo.count()).toBe(0);
    });

    test("increment / decrement adjust matched rows", async () => {
      const repo = createMockRepository<Row>([{ id: "row_1", count: 5 }]);

      await repo.increment({ id: "row_1" } as any, "count" as any, 3);
      expect((await repo.findOne({ id: "row_1" } as any))?.count).toBe(8);

      await repo.decrement({ id: "row_1" } as any, "count" as any, 2);
      expect((await repo.findOne({ id: "row_1" } as any))?.count).toBe(6);
    });

    test("updateMany assigns to all matched rows", async () => {
      const repo = createMockRepository<Row>([
        { id: "row_1", name: "a" },
        { id: "row_2", name: "a" },
      ]);

      await repo.updateMany({ name: "a" } as any, { name: "z" } as any);
      expect(await repo.count({ name: "z" } as any)).toBe(2);
    });

    test("findOneOrSave returns the existing match, else inserts", async () => {
      const repo = createMockRepository<Row>([{ id: "row_1", name: "existing" }]);

      expect(
        await repo.findOneOrSave({ id: "row_1" } as any, { name: "x" } as any),
      ).toEqual({ id: "row_1", name: "existing" });

      const saved = await repo.findOneOrSave(
        { id: "row_2" } as any,
        {
          name: "new",
        } as any,
      );
      expect(saved.name).toBe("new");
      expect(await repo.count()).toBe(2);
    });

    test("findOneOrFail throws when nothing matches", async () => {
      const repo = createMockRepository<Row>([{ id: "row_1" }]);

      expect(await repo.findOneOrFail({ id: "row_1" } as any)).toEqual({ id: "row_1" });
      await expect(repo.findOneOrFail({ id: "nope" } as any)).rejects.toThrow(
        "Entity not found",
      );
    });

    test("clear empties the store", async () => {
      const repo = createMockRepository<Row>([{ id: "row_1" }, { id: "row_2" }]);

      await repo.clear();
      expect(await repo.count()).toBe(0);
    });

    test("write methods remain spies", async () => {
      const repo = createMockRepository<Row>([]);

      await repo.insert({ name: "a" } as any);
      expect(repo.insert).toHaveBeenCalledTimes(1);
      expect(vi.isMockFunction(repo.insert)).toBe(true);
    });
  });
});
