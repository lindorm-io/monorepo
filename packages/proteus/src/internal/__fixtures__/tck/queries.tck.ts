import { describe, test, expect, beforeEach } from "vitest";
// TCK: Queries Suite
// Tests find options: ordering, pagination, limit, offset, select, distinct.

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const queriesSuite = (getHandle: () => TckDriverHandle, entities: TckEntities) => {
  describe("Queries", () => {
    const { TckSimpleUser } = entities;

    beforeEach(async () => {
      await getHandle().clear();
      const repo = getHandle().repository(TckSimpleUser);
      await repo.insert({ name: "Alice", age: 30, email: "alice@test.com" });
      await repo.insert({ name: "Bob", age: 20, email: "bob@test.com" });
      await repo.insert({ name: "Charlie", age: 40, email: "charlie@test.com" });
      await repo.insert({ name: "Dave", age: 20, email: "dave@test.com" });
    });

    test("find with order ASC", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find(undefined, { order: { age: "ASC", name: "ASC" } });

      expect(results).toHaveLength(4);
      expect(results[0].name).toBe("Bob");
      expect(results[1].name).toBe("Dave");
      expect(results[2].name).toBe("Alice");
      expect(results[3].name).toBe("Charlie");
    });

    test("find with order DESC", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find(undefined, { order: { age: "DESC" } });

      expect(results).toHaveLength(4);
      expect(results[0].age).toBe(40);
    });

    test("find with limit", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find(undefined, { limit: 2, order: { name: "ASC" } });

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("Alice");
      expect(results[1].name).toBe("Bob");
    });

    test("find with offset", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find(undefined, {
        limit: 2,
        offset: 2,
        order: { name: "ASC" },
      });

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("Charlie");
      expect(results[1].name).toBe("Dave");
    });

    test("find with limit and offset", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const page1 = await repo.find(undefined, {
        limit: 2,
        offset: 0,
        order: { name: "ASC" },
      });
      const page2 = await repo.find(undefined, {
        limit: 2,
        offset: 2,
        order: { name: "ASC" },
      });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].name).toBe("Alice");
      expect(page2[0].name).toBe("Charlie");
    });

    test("findAndCount returns entities and total", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const [results, total] = await repo.findAndCount(undefined, {
        limit: 2,
        order: { name: "ASC" },
      });

      expect(results).toHaveLength(2);
      expect(total).toBe(4);
    });

    test("find with select limits returned fields", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find(undefined, {
        select: ["id", "name"],
        limit: 1,
        order: { name: "ASC" },
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBeDefined();
      expect(results[0].name).toBe("Alice");
    });

    test("find returns empty array when no matches", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find({ name: "NonExistent" });

      expect(results).toEqual([]);
    });

    test("find with multiple criteria fields (AND)", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find({ age: 20, name: "Bob" });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Bob");
    });

    test("updateMany modifies matching entities", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      await repo.updateMany({ age: 20 }, { age: 21 });

      const updated = await repo.find({ age: 21 });
      expect(updated).toHaveLength(2);
    });

    test("count returns zero for empty store", async () => {
      await getHandle().clear();
      const repo = getHandle().repository(TckSimpleUser);
      const count = await repo.count();
      expect(count).toBe(0);
    });

    test("find returns entities with correct shape", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find(undefined, { limit: 1 });

      // Verify entity has all expected properties with correct types
      expect(results[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          version: expect.any(Number),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );
    });

    test("findOne with criteria returns correct entity", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      // We don't have ids array anymore, so insert and find by name
      const found = await repo.findOne({ name: "Charlie" });

      expect(found).not.toBeNull();
      expect(found!.name).toBe("Charlie");
    });

    // A2: Advanced match operators

    test("find with $gt filters greater than", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find({ age: { $gt: 30 } });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Charlie");
    });

    test("find with $gte filters greater than or equal", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find({ age: { $gte: 30 } }, { order: { name: "ASC" } });

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("Alice");
      expect(results[1].name).toBe("Charlie");
    });

    test("find with $lt filters less than", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find({ age: { $lt: 30 } }, { order: { name: "ASC" } });

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("Bob");
      expect(results[1].name).toBe("Dave");
    });

    test("find with $lte filters less than or equal", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find({ age: { $lte: 20 } }, { order: { name: "ASC" } });

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("Bob");
      expect(results[1].name).toBe("Dave");
    });

    test("find with $ne filters not equal", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find({ age: { $neq: 20 } });

      expect(results).toHaveLength(2);
    });

    test("find with $in matches any value in array", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find({ name: { $in: ["Alice", "Charlie"] } });

      expect(results).toHaveLength(2);
    });

    test("find with $nin excludes values in array", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find(
        { name: { $nin: ["Alice", "Charlie"] } },
        { order: { name: "ASC" } },
      );

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("Bob");
      expect(results[1].name).toBe("Dave");
    });

    test("find with $like matches pattern", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find(
        { name: { $like: "%li%" } },
        { order: { name: "ASC" } },
      );

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("Alice");
      expect(results[1].name).toBe("Charlie");
    });

    // D4: updateMany semantics

    test("updateMany on no matches is a no-op", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      await expect(
        repo.updateMany({ name: "Nobody" }, { age: 99 }),
      ).resolves.not.toThrow();
    });

    // ─── P1-F03: WHERE clause with null criteria value ──────────────────────────
    test("find with null criteria value alongside valid field returns correct results", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      // Alice has email: "alice@test.com". Using null + name avoids WHERE AND prefix bug.
      const results = await repo.find({ email: null, name: "Alice" });
      // Alice's email is not null, so no match expected when email IS NULL AND name = Alice
      // But this validates that the WHERE clause is well-formed (no "WHERE AND" error)
      expect(results).toHaveLength(0);
    });

    test("find with null value as first criteria key does not corrupt WHERE clause", async () => {
      await getHandle().clear();
      const repo = getHandle().repository(TckSimpleUser);
      await repo.insert({ name: "NullFirst", email: null, age: 5 });
      await repo.insert({ name: "NullFirst", email: "has@email.com", age: 10 });

      const results = await repo.find({ email: null, name: "NullFirst" });
      expect(results).toHaveLength(1);
      expect(results[0].age).toBe(5);
    });

    // ─── P2-F07: findPaginated page: 0 must throw ─────────────────────────────
    test("findPaginated with page:0 throws", async () => {
      const repo = getHandle().repository(TckSimpleUser);

      await expect(
        repo.findPaginated(undefined, { page: 0, pageSize: 2, order: { name: "ASC" } }),
      ).rejects.toThrow();
    });

    // ─── P2-F06: NULL ordering consistency ─────────────────────────────────────
    test("find ordered ASC by nullable field places NULLs last", async () => {
      await getHandle().clear();
      const repo = getHandle().repository(TckSimpleUser);

      await repo.insert({ name: "HasEmail", email: "a@test.com", age: 10 });
      await repo.insert({ name: "NoEmail", email: null, age: 20 });
      await repo.insert({ name: "HasEmail2", email: "b@test.com", age: 30 });

      const results = await repo.find(undefined, { order: { email: "ASC" } });
      expect(results).toHaveLength(3);

      // NULLs LAST for ASC (Postgres/SQL standard default)
      const lastItem = results[results.length - 1];
      expect(lastItem.email).toBeNull();
    });

    test("find ordered DESC by nullable field places NULLs first", async () => {
      await getHandle().clear();
      const repo = getHandle().repository(TckSimpleUser);

      await repo.insert({ name: "HasEmail", email: "a@test.com", age: 10 });
      await repo.insert({ name: "NoEmail", email: null, age: 20 });
      await repo.insert({ name: "HasEmail2", email: "b@test.com", age: 30 });

      const results = await repo.find(undefined, { order: { email: "DESC" } });
      expect(results).toHaveLength(3);

      // NULLs FIRST for DESC (Postgres/SQL standard default)
      expect(results[0].email).toBeNull();
    });

    // ─── Empty array predicates ─────────────────────────────────────────────────
    test("find with empty $in array returns empty result without error", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find({ name: { $in: [] } });
      expect(results).toEqual([]);
    });

    // ─── findPaginated ──────────────────────────────────────────────────

    test("findPaginated returns first page ordered by name", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.findPaginated(undefined, {
        page: 1,
        pageSize: 2,
        order: { name: "ASC" },
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(4);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(result.hasMore).toBe(true);
      expect(result.data[0].name).toBe("Alice");
      expect(result.data[1].name).toBe("Bob");
    });

    test("findPaginated returns second page ordered by name", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.findPaginated(undefined, {
        page: 2,
        pageSize: 2,
        order: { name: "ASC" },
      });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.data[0].name).toBe("Charlie");
      expect(result.data[1].name).toBe("Dave");
    });

    test("findPaginated returns empty data for page beyond results", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.findPaginated(undefined, {
        page: 3,
        pageSize: 2,
        order: { name: "ASC" },
      });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(4);
      expect(result.totalPages).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    test("findPaginated uses default page and pageSize", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.findPaginated();

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.data).toHaveLength(4);
      expect(result.hasMore).toBe(false);
    });

    test("findPaginated respects criteria", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.findPaginated(
        { age: 20 },
        {
          pageSize: 1,
          order: { name: "ASC" },
        },
      );

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(true);
      expect(result.data[0].name).toBe("Bob");
    });

    test("findPaginated computes totalPages for non-even division", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.findPaginated(undefined, {
        page: 1,
        pageSize: 3,
        order: { name: "ASC" },
      });

      expect(result.totalPages).toBe(2);
      expect(result.data).toHaveLength(3);
      expect(result.hasMore).toBe(true);
    });
  });
};
