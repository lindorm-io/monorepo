import { describe, test, expect, beforeEach } from "vitest";
// TCK: Check Constraints Suite
// Gated behind caps.checkConstraints — runs only on drivers that emit and
// enforce DB-level CHECK constraints. Memory cannot evaluate arbitrary SQL
// CHECK expressions, so it skips this suite entirely, documenting the gap
// explicitly rather than silently accepting check-violating rows.

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError.js";

export const checkConstraintsSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("Check Constraints", () => {
    const { TckChecked } = entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("insert satisfying the CHECK expression succeeds", async () => {
      const repo = getHandle().repository(TckChecked);
      const inserted = await repo.insert({ name: "valid", quantity: 5 });

      expect(inserted.id).toBeDefined();
      expect(inserted.quantity).toBe(5);
    });

    test("insert violating the CHECK expression rejects", async () => {
      const repo = getHandle().repository(TckChecked);

      await expect(repo.insert({ name: "invalid", quantity: -1 })).rejects.toThrow(
        ProteusRepositoryError,
      );
    });

    test("update violating the CHECK expression rejects", async () => {
      const repo = getHandle().repository(TckChecked);
      const inserted = await repo.insert({ name: "ok", quantity: 3 });

      await expect(
        repo.updateMany({ id: inserted.id }, { quantity: -10 }),
      ).rejects.toThrow(ProteusRepositoryError);
    });
  });
};
