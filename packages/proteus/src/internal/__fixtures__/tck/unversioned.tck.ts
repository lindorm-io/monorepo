import { describe, test, expect, beforeEach } from "vitest";
// TCK: Unversioned Entity Suite
// Verifies that CRUD works correctly without @VersionField.

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const unversionedSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("Unversioned", () => {
    const { TckUnversioned } = entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("insert creates entity without version field", async () => {
      const repo = getHandle().repository(TckUnversioned);
      const result = await repo.insert({ name: "Alice", score: 10 });

      expect(result.id).toBeDefined();
      expect(result.name).toBe("Alice");
      expect(result.score).toBe(10);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect((result as any).version).toBeUndefined();
    });

    test("findOne returns unversioned entity", async () => {
      const repo = getHandle().repository(TckUnversioned);
      const created = await repo.insert({ name: "Bob", score: 5 });

      const found = await repo.findOne({ id: created.id });
      expect(found).not.toBeNull();
      expect(found!.name).toBe("Bob");
      expect(found!.score).toBe(5);
    });

    test("update modifies entity without version increment", async () => {
      const repo = getHandle().repository(TckUnversioned);
      const created = await repo.insert({ name: "Charlie", score: 0 });

      created.name = "Charles";
      created.score = 42;
      const updated = await repo.update(created);

      expect(updated.name).toBe("Charles");
      expect(updated.score).toBe(42);
    });

    test("save detects insert vs update", async () => {
      const repo = getHandle().repository(TckUnversioned);

      // Insert path
      const saved = await repo.save({ name: "Dave", score: 1 });
      expect(saved.id).toBeDefined();
      expect(saved.name).toBe("Dave");

      // Update path
      saved.name = "David";
      const reSaved = await repo.save(saved);
      expect(reSaved.name).toBe("David");

      const all = await repo.find();
      expect(all).toHaveLength(1);
    });

    test("destroy removes unversioned entity", async () => {
      const repo = getHandle().repository(TckUnversioned);
      const created = await repo.insert({ name: "Eve", score: 100 });

      await repo.destroy(created);

      const found = await repo.findOne({ id: created.id });
      expect(found).toBeNull();
    });

    test("default value is applied when field omitted", async () => {
      const repo = getHandle().repository(TckUnversioned);
      const result = await repo.insert({ name: "Frank" });
      expect(result.score).toBe(0);
    });

    test("find returns multiple unversioned entities", async () => {
      const repo = getHandle().repository(TckUnversioned);
      await repo.insert({ name: "A", score: 1 });
      await repo.insert({ name: "B", score: 2 });
      await repo.insert({ name: "C", score: 3 });

      const all = await repo.find();
      expect(all).toHaveLength(3);
    });
  });
};
