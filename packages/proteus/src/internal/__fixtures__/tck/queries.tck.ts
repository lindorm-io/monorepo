import { describe, test, expect, beforeEach } from "vitest";
// TCK: Queries Suite
// Tests find options: ordering, pagination, limit, offset, select, distinct.

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";
import { getSnapshot } from "../../entity/utils/snapshot-store.js";

export const queriesSuite = (getHandle: () => TckDriverHandle, entities: TckEntities) => {
  describe("Queries", () => {
    const { TckSimpleUser, TckJsonHolder, TckFkParent, TckFkAutoNullableChild } =
      entities;

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

    // A projection key that means nothing used to be accepted and dropped: it
    // matched no field, narrowed nothing, and came back as a silently missing
    // column on every driver.
    test("find rejects a select key that is not declared", async () => {
      const repo = getHandle().repository(TckSimpleUser);

      await expect(repo.find(undefined, { select: ["naem" as "name"] })).rejects.toThrow(
        /Unknown field "naem"/,
      );
    });

    test("find rejects a relation named in select", async () => {
      const repo = getHandle().repository(TckSimpleUser);

      await expect(repo.find(undefined, { select: ["posts"] })).rejects.toThrow(
        /Relation "posts" cannot be selected/,
      );
    });

    // `parentId` is a @RelationId with no @Field of its own. Naming it must be
    // accepted and must not change its value — asserted against the unprojected
    // read rather than against the parent's id, because what a driver stores for
    // an auto-FK written through a relation OBJECT is its own business (the ones
    // without referential integrity leave it null).
    test("find accepts a @RelationId property in select", async () => {
      const parentRepo = getHandle().repository(TckFkParent);
      const childRepo = getHandle().repository(TckFkAutoNullableChild);

      const parent = await parentRepo.insert({ name: "SelectableRelationId" });
      const child = await childRepo.insert({ value: "with-parent", parent });

      const [full] = await childRepo.find({ id: child.id });
      const projected = await childRepo.find(
        { id: child.id },
        { select: ["id", "parentId"] },
      );

      expect(projected).toHaveLength(1);
      expect(projected[0].id).toBe(child.id);
      expect(projected[0].parentId).toEqual(full.parentId);

      // An owning *ToOne points at one parent, so its id is that one value —
      // never a list.
      expect(Array.isArray(projected[0].parentId)).toBe(false);
    });

    // A @RelationCount is populated by the repository, so the repository is
    // where it may be named. It used to be neither: an unprojected find filled
    // it while a projection that named it was refused as an unknown field.
    test("find accepts a @RelationCount property in select", async () => {
      const parentRepo = getHandle().repository(TckFkParent);
      const childRepo = getHandle().repository(TckFkAutoNullableChild);

      const parent = await parentRepo.insert({ name: "SelectableRelationCount" });
      await childRepo.insert({ value: "one", parent });
      await childRepo.insert({ value: "two", parent });

      const projected = await parentRepo.find(
        { id: parent.id },
        { select: ["id", "autoNullableChildCount"] },
      );

      expect(projected).toHaveLength(1);
      expect(projected[0].autoNullableChildCount).toBe(2);
    });

    // Every relation count costs a query of its own, so an unnamed one is a
    // round trip for a value nobody asked for — the same bargain a relation id
    // strikes. A count left out comes back as null where a backing column was
    // simply not selected, and absent where the property has no column at all.
    test("find skips the @RelationCount and @RelationId a projection omits", async () => {
      const parentRepo = getHandle().repository(TckFkParent);
      const childRepo = getHandle().repository(TckFkAutoNullableChild);

      const parent = await parentRepo.insert({ name: "SkippedRelationValues" });
      await childRepo.insert({ value: "one", parent });

      const [projected] = await parentRepo.find(
        { id: parent.id },
        { select: ["id", "name"] },
      );

      expect([null, undefined]).toContain(projected.autoNullableChildCount);
      expect(projected.autoNullableChildIds).toBeUndefined();
    });

    test("find still populates both when there is no projection", async () => {
      const parentRepo = getHandle().repository(TckFkParent);
      const childRepo = getHandle().repository(TckFkAutoNullableChild);

      const parent = await parentRepo.insert({ name: "UnprojectedRelationValues" });
      await childRepo.insert({ value: "one", parent });

      const [full] = await parentRepo.find({ id: parent.id });

      expect(full.autoNullableChildCount).toBe(1);
      expect(full.autoNullableChildIds).toBeDefined();
    });

    // A @RelationId takes the shape of the relation's cardinality, and a
    // OneToMany has many children — so it carries EVERY child's id. Asserting
    // only that the property is there passed on the drivers that read the
    // relation with findOne and handed back a single child's id as a bare
    // string, losing the rest without a word.
    test("find loads every child's id into a OneToMany @RelationId", async () => {
      const parentRepo = getHandle().repository(TckFkParent);
      const childRepo = getHandle().repository(TckFkAutoNullableChild);

      const parent = await parentRepo.insert({ name: "AllChildRelationIds" });
      const first = await childRepo.insert({ value: "one", parent });
      const second = await childRepo.insert({ value: "two", parent });
      const third = await childRepo.insert({ value: "three", parent });

      const [full] = await parentRepo.find({ id: parent.id });

      expect(Array.isArray(full.autoNullableChildIds)).toBe(true);
      expect(full.autoNullableChildIds).toHaveLength(3);
      expect([...full.autoNullableChildIds].sort()).toEqual(
        [first.id, second.id, third.id].sort(),
      );
    });

    // The same shape holds with nothing to put in it: a childless parent gets
    // the empty list, not null and not a missing property.
    test("find gives a childless OneToMany @RelationId an empty array", async () => {
      const parentRepo = getHandle().repository(TckFkParent);

      const parent = await parentRepo.insert({ name: "NoChildRelationIds" });

      const [full] = await parentRepo.find({ id: parent.id });

      expect(full.autoNullableChildIds).toEqual([]);
    });

    // Projected or not, the value is the same value.
    test("find loads every child's id into a projected OneToMany @RelationId", async () => {
      const parentRepo = getHandle().repository(TckFkParent);
      const childRepo = getHandle().repository(TckFkAutoNullableChild);

      const parent = await parentRepo.insert({ name: "ProjectedChildRelationIds" });
      const first = await childRepo.insert({ value: "one", parent });
      const second = await childRepo.insert({ value: "two", parent });

      const [projected] = await parentRepo.find(
        { id: parent.id },
        { select: ["id", "autoNullableChildIds"] },
      );

      expect(projected.autoNullableChildIds).toHaveLength(2);
      expect([...projected.autoNullableChildIds].sort()).toEqual(
        [first.id, second.id].sort(),
      );
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

    // A partial update must store a structured value the same way a full write
    // does. Redis hand-rolled `String(value)` here, which flattened json/object/
    // array columns to "[object Object]" — silent data corruption on updateMany.
    test("updateMany preserves plain json / object / array column values", async () => {
      const repo = getHandle().repository(TckJsonHolder);

      const inserted = await repo.insert({
        metadata: { a: 1 },
        settings: { theme: "dark", count: 1 },
        payload: { items: ["one"], count: 1 },
      });

      await repo.updateMany(
        { id: inserted.id },
        {
          metadata: { a: 2, nested: { deep: true } },
          settings: { theme: "light", count: 7 },
          payload: { items: ["two", "three"], count: 2 },
        },
      );

      const found = await repo.findOneOrFail({ id: inserted.id });
      expect(found.metadata).toEqual({ a: 2, nested: { deep: true } });
      expect(found.settings).toEqual({ theme: "light", count: 7 });
      expect(found.payload).toEqual({ items: ["two", "three"], count: 2 });
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

    // ─── F12: offset finds use `order`; passing keyset `orderBy` must throw ─────
    test("findPaginated rejects the keyset `orderBy` key (use `order`)", async () => {
      const repo = getHandle().repository(TckSimpleUser);

      await expect(
        repo.findPaginated(undefined, {
          pageSize: 2,
          // wrong key for offset pagination — must not be silently ignored
          orderBy: { name: "ASC" },
        } as any),
      ).rejects.toThrow(/orderBy/);
    });

    test("find rejects the keyset `orderBy` key (use `order`)", async () => {
      const repo = getHandle().repository(TckSimpleUser);

      await expect(
        repo.find(undefined, { orderBy: { name: "ASC" } } as any),
      ).rejects.toThrow(/orderBy/);
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

    // ─── snapshot opt-out ────────────────────────────────────────────
    //
    // Validates that callers can disable change-tracker snapshot construction
    // on read paths. When { snapshot: false } is passed, hydrated entities have
    // no snapshot in the WeakMap, so update() falls back to writing every
    // column instead of issuing a minimal column-diff UPDATE.

    test("find stores snapshot by default", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find({ name: "Alice" });

      expect(results).toHaveLength(1);
      expect(getSnapshot(results[0])).not.toBeNull();
    });

    test("find with { snapshot: false } skips snapshot", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find({ name: "Alice" }, { snapshot: false });

      expect(results).toHaveLength(1);
      expect(getSnapshot(results[0])).toBeNull();
    });

    test("findOne with { snapshot: false } skips snapshot", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const entity = await repo.findOne({ name: "Alice" }, { snapshot: false });

      expect(entity).not.toBeNull();
      expect(getSnapshot(entity!)).toBeNull();
    });

    test("findPaginated with { snapshot: false } skips snapshot on every row", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.findPaginated(undefined, {
        page: 1,
        pageSize: 10,
        order: { name: "ASC" },
        snapshot: false,
      });

      expect(result.data.length).toBeGreaterThan(0);
      for (const entity of result.data) {
        expect(getSnapshot(entity)).toBeNull();
      }
    });

    test("update on no-snapshot entity succeeds (writes every column)", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const [entity] = await repo.find({ name: "Alice" }, { snapshot: false });

      expect(getSnapshot(entity)).toBeNull();

      entity.age = 31;
      const updated = await repo.update(entity);

      expect(updated.age).toBe(31);

      // Verify the change persisted by reloading
      const reloaded = await repo.findOne({ name: "Alice" });
      expect(reloaded).not.toBeNull();
      expect(reloaded!.age).toBe(31);
    });
  });
};
