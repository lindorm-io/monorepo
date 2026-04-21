import { describe, test, expect, beforeEach } from "vitest";
// TCK: Clear/Truncate Suite
// Verifies that clear() truncates the table.

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const clearSuite = (getHandle: () => TckDriverHandle, entities: TckEntities) => {
  describe("Clear", () => {
    const { TckUnversioned } = entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("clear removes all rows from the table", async () => {
      const repo = getHandle().repository(TckUnversioned);
      await repo.insert({ name: "A", score: 1 });
      await repo.insert({ name: "B", score: 2 });
      await repo.insert({ name: "C", score: 3 });

      const before = await repo.find();
      expect(before).toHaveLength(3);

      await repo.clear();

      const after = await repo.find();
      expect(after).toHaveLength(0);
    });

    test("clear is idempotent on empty table", async () => {
      const repo = getHandle().repository(TckUnversioned);
      await repo.clear();
      await repo.clear();

      const result = await repo.find();
      expect(result).toHaveLength(0);
    });

    test("insert works after clear", async () => {
      const repo = getHandle().repository(TckUnversioned);
      await repo.insert({ name: "Before", score: 1 });
      await repo.clear();

      const result = await repo.insert({ name: "After", score: 2 });
      expect(result.name).toBe("After");

      const all = await repo.find();
      expect(all).toHaveLength(1);
    });
  });
};
