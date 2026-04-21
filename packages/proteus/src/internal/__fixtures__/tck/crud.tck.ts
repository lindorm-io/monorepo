import { describe, test, it, expect, beforeEach } from "vitest";
// TCK: CRUD Suite
// Structural assertions (not snapshots) for cross-driver portability.

import type { TckDriverHandle } from "./types";
import type { TckEntities } from "./create-tck-entities";
import { ProteusError } from "../../../errors/ProteusError";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError";

export const crudSuite = (getHandle: () => TckDriverHandle, entities: TckEntities) => {
  describe("CRUD", () => {
    const { TckSimpleUser } = entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("insert creates a new entity and returns it with generated fields", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.insert({
        name: "Alice",
        email: "alice@test.com",
        age: 30,
      });

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe("string");
      expect(result.name).toBe("Alice");
      expect(result.email).toBe("alice@test.com");
      expect(result.age).toBe(30);
      expect(result.version).toBe(1);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    test("insert with partial fields applies defaults", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.insert({ name: "Bob" });

      expect(result.name).toBe("Bob");
      expect(result.email).toBeNull();
      expect(result.age).toBe(0);
    });

    test("findOne retrieves an inserted entity", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const inserted = await repo.insert({ name: "Charlie", email: null, age: 25 });

      const found = await repo.findOne({ id: inserted.id });

      expect(found).not.toBeNull();
      expect(found!.id).toBe(inserted.id);
      expect(found!.name).toBe("Charlie");
    });

    test("createdAt and updatedAt millisecond precision is preserved through SELECT", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const inserted = await repo.insert({ name: "DatePrecision" });

      // The ORM sets createdAt/updatedAt internally — verify the SELECT path
      // returns the exact same millisecond value as the INSERT RETURNING path.
      const found = await repo.findOne({ id: inserted.id });

      expect(found!.createdAt.getTime()).toBe(inserted.createdAt.getTime());
      expect(found!.updatedAt.getTime()).toBe(inserted.updatedAt.getTime());
    });

    test("findOne returns null for non-existent entity", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const found = await repo.findOne({ id: "00000000-0000-0000-0000-000000000000" });

      expect(found).toBeNull();
    });

    test("findOneOrFail throws ProteusRepositoryError for non-existent entity", async () => {
      const repo = getHandle().repository(TckSimpleUser);

      await expect(
        repo.findOneOrFail({ id: "00000000-0000-0000-0000-000000000000" }),
      ).rejects.toThrow(ProteusRepositoryError);
    });

    test("find returns all matching entities", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      await repo.insert({ name: "D1", age: 10 });
      await repo.insert({ name: "D2", age: 20 });
      await repo.insert({ name: "D3", age: 30 });

      const all = await repo.find();
      expect(all).toHaveLength(3);
    });

    test("find with criteria filters results", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      await repo.insert({ name: "E1", age: 10 });
      await repo.insert({ name: "E2", age: 20 });

      const filtered = await repo.find({ name: "E1" });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("E1");
    });

    test("update modifies an entity and increments version", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const inserted = await repo.insert({ name: "Frank", age: 40 });

      expect(inserted.version).toBe(1);

      inserted.name = "Franklin";
      const updated = await repo.update(inserted);

      expect(updated.name).toBe("Franklin");
      expect(updated.version).toBe(2);
      expect(updated.id).toBe(inserted.id);
    });

    test("update rejects stale version (optimistic lock)", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const inserted = await repo.insert({ name: "Grace", age: 50 });

      // Simulate stale version
      const stale = repo.copy(inserted);
      inserted.name = "Grace Updated";
      await repo.update(inserted);

      stale.name = "Grace Stale";
      await expect(repo.update(stale)).rejects.toThrow(ProteusError);
    });

    test("save inserts new entity", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.save({ name: "Harry" });

      expect(result.id).toBeDefined();
      expect(result.name).toBe("Harry");
      expect(result.version).toBe(1);
    });

    test("save updates existing entity", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const inserted = await repo.insert({ name: "Ivy" });

      inserted.name = "Ivy Updated";
      const saved = await repo.save(inserted);

      expect(saved.name).toBe("Ivy Updated");
      expect(saved.version).toBe(2);
    });

    test("destroy removes entity from store", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const inserted = await repo.insert({ name: "Jack" });

      await repo.destroy(inserted);

      const found = await repo.findOne({ id: inserted.id });
      expect(found).toBeNull();
    });

    test("destroy on non-existent entity is a no-op", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      // Insert and then delete — now destroy a stale reference (already deleted)
      const entity = await repo.insert({ name: "Ghost" });
      await repo.destroy(entity);

      // Second destroy on same (now non-existent) entity should not throw
      await expect(repo.destroy(entity)).resolves.toBeUndefined();
    });

    test("delete removes matching entities by criteria", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      await repo.insert({ name: "K1", age: 10 });
      await repo.insert({ name: "K2", age: 10 });
      await repo.insert({ name: "K3", age: 20 });

      await repo.delete({ age: 10 });

      const remaining = await repo.find();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].name).toBe("K3");
    });

    test("clone creates a copy with new PK and version 1", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const original = await repo.insert({ name: "Original", age: 99 });

      original.name = "Original v2";
      await repo.update(original);

      const cloned = await repo.clone(original);

      expect(cloned.id).not.toBe(original.id);
      expect(cloned.name).toBe("Original v2");
      expect(cloned.age).toBe(99);
      expect(cloned.version).toBe(1);
    });

    test("count returns total number of entities", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      await repo.insert({ name: "C1" });
      await repo.insert({ name: "C2" });
      await repo.insert({ name: "C3" });

      const total = await repo.count();
      expect(total).toBe(3);
    });

    test("count with criteria returns filtered count", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      await repo.insert({ name: "Same", age: 10 });
      await repo.insert({ name: "Same", age: 10 });
      await repo.insert({ name: "Other", age: 20 });

      const count = await repo.count({ name: "Same" });
      expect(count).toBe(2);
    });

    test("exists returns true when entity matches criteria", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      await repo.insert({ name: "Exist" });

      const result = await repo.exists({ name: "Exist" });
      expect(result).toBe(true);
    });

    test("exists returns false when no entity matches criteria", async () => {
      const repo = getHandle().repository(TckSimpleUser);

      const result = await repo.exists({ name: "NonExistent" });
      expect(result).toBe(false);
    });

    test("duplicate insert rejects", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const inserted = await repo.insert({ name: "Dup" });

      await expect(repo.insert(inserted)).rejects.toThrow(ProteusRepositoryError);
    });

    test("findOneOrSave returns existing if found", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const inserted = await repo.insert({ name: "FindOrSave" });

      const result = await repo.findOneOrSave(
        { name: "FindOrSave" },
        { name: "FindOrSave" },
      );
      expect(result.id).toBe(inserted.id);
    });

    test("findOneOrSave inserts if not found", async () => {
      const repo = getHandle().repository(TckSimpleUser);

      const result = await repo.findOneOrSave(
        { name: "NotYet" },
        { name: "NotYet", age: 42 },
      );
      expect(result.id).toBeDefined();
      expect(result.name).toBe("NotYet");
      expect(result.age).toBe(42);
    });

    test("batch insert creates multiple entities", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.insert([{ name: "B1" }, { name: "B2" }]);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBeDefined();
      expect(results[1].id).toBeDefined();
      expect(results[0].id).not.toBe(results[1].id);
      expect(results[0].name).toBe("B1");
      expect(results[1].name).toBe("B2");
    });

    test("batch update modifies multiple entities", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const e1 = await repo.insert({ name: "BatchU1" });
      const e2 = await repo.insert({ name: "BatchU2" });

      e1.name = "BatchU1 Updated";
      e2.name = "BatchU2 Updated";
      const results = await repo.update([e1, e2]);

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("BatchU1 Updated");
      expect(results[1].name).toBe("BatchU2 Updated");
      expect(results[0].version).toBe(2);
      expect(results[1].version).toBe(2);
    });

    test("batch save inserts and updates", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const inserted = await repo.insert({ name: "BatchSaveExisting" });

      inserted.name = "BatchSaveExisting Updated";
      const results = await repo.save([{ name: "BatchSaveNew" }, inserted]);

      expect(results).toHaveLength(2);
    });

    test("batch destroy removes multiple entities", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const e1 = await repo.insert({ name: "BatchD1" });
      const e2 = await repo.insert({ name: "BatchD2" });

      await repo.destroy([e1, e2]);

      const remaining = await repo.find();
      expect(remaining).toHaveLength(0);
    });

    test("batch clone creates copies", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const e1 = await repo.insert({ name: "BatchClone1" });
      const e2 = await repo.insert({ name: "BatchClone2" });

      await repo.clone([e1, e2]);

      const all = await repo.find();
      expect(all).toHaveLength(4);
    });

    test("copy produces independent deep copy", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const original = await repo.insert({ name: "CopySource", age: 77 });

      const copied = repo.copy(original);

      expect(copied.id).toBe(original.id);
      expect(copied.name).toBe("CopySource");
      expect(copied.age).toBe(77);

      copied.name = "CopyMutated";
      expect(original.name).toBe("CopySource");
    });
  });
};
