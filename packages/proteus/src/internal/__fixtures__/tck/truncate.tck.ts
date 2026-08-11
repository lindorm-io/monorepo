import { describe, test, expect, beforeEach } from "vitest";
// TCK: Truncate Suite
// Verifies that truncate() empties the table.

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const truncateSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("Truncate", () => {
    const { TckUnversioned } = entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("truncate removes all rows from the table", async () => {
      const repo = getHandle().repository(TckUnversioned);
      await repo.insert({ name: "A", score: 1 });
      await repo.insert({ name: "B", score: 2 });
      await repo.insert({ name: "C", score: 3 });

      const before = await repo.find();
      expect(before).toHaveLength(3);

      await repo.truncate();

      const after = await repo.find();
      expect(after).toHaveLength(0);
    });

    test("truncate is idempotent on empty table", async () => {
      const repo = getHandle().repository(TckUnversioned);
      await repo.truncate();
      await repo.truncate();

      const result = await repo.find();
      expect(result).toHaveLength(0);
    });

    test("insert works after truncate", async () => {
      const repo = getHandle().repository(TckUnversioned);
      await repo.insert({ name: "Before", score: 1 });
      await repo.truncate();

      const result = await repo.insert({ name: "After", score: 2 });
      expect(result.name).toBe("After");

      const all = await repo.find();
      expect(all).toHaveLength(1);
    });
  });
};
