import { describe, test, expect, beforeEach } from "vitest";
// TCK: Renamed Columns Suite
// Exercises scalar fields whose physical column name (@Field({ name }))
// differs from the entity property key. Memory keys rows by field.key and
// ignores the column name; SQL drivers map to the renamed column. Both must
// round-trip a full insert → find-by-property → update → delete cycle.

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const renamedColumnsSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("Renamed Columns", () => {
    const { TckRenamedColumns } = entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("insert round-trips renamed scalar columns by property key", async () => {
      const repo = getHandle().repository(TckRenamedColumns);
      const inserted = await repo.insert({
        displayName: "Ada Lovelace",
        loginCount: 7,
        emailAddress: "ada@test.com",
      });

      expect(inserted.displayName).toBe("Ada Lovelace");
      expect(inserted.loginCount).toBe(7);
      expect(inserted.emailAddress).toBe("ada@test.com");

      const found = await repo.findOneOrFail({ id: inserted.id });
      expect(found.displayName).toBe("Ada Lovelace");
      expect(found.loginCount).toBe(7);
      expect(found.emailAddress).toBe("ada@test.com");
    });

    test("findOne filters by a renamed scalar property", async () => {
      const repo = getHandle().repository(TckRenamedColumns);
      await repo.insert({ displayName: "Grace Hopper", loginCount: 1 });
      await repo.insert({ displayName: "Alan Turing", loginCount: 2 });

      const found = await repo.findOne({ displayName: "Grace Hopper" });

      expect(found).not.toBeNull();
      expect(found!.displayName).toBe("Grace Hopper");
      expect(found!.emailAddress).toBeNull();
    });

    test("update mutates a renamed scalar column", async () => {
      const repo = getHandle().repository(TckRenamedColumns);
      const inserted = await repo.insert({ displayName: "Edsger", loginCount: 0 });

      inserted.displayName = "Edsger Dijkstra";
      inserted.loginCount = 42;
      const updated = await repo.update(inserted);

      expect(updated.displayName).toBe("Edsger Dijkstra");
      expect(updated.loginCount).toBe(42);
      expect(updated.version).toBe(2);

      const found = await repo.findOneOrFail({ id: inserted.id });
      expect(found.displayName).toBe("Edsger Dijkstra");
      expect(found.loginCount).toBe(42);
    });

    test("delete by renamed property removes the row", async () => {
      const repo = getHandle().repository(TckRenamedColumns);
      await repo.insert({ displayName: "Keep", loginCount: 1 });
      await repo.insert({ displayName: "Remove", loginCount: 1 });

      await repo.delete({ displayName: "Remove" });

      const remaining = await repo.find();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].displayName).toBe("Keep");
    });
  });
};
