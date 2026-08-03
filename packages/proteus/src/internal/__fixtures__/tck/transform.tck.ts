// TCK: Transform Suite
//
// Verifies @Transform is applied EXACTLY ONCE per direction, on every driver and
// every write path. `defaultHydrateEntity` owns `transform.from()` for all
// drivers; a driver that also applies it in its own row deserialiser transforms
// the value twice. The entity's transforms are non-idempotent, so a second
// application is observable (redis applied `from` twice until this suite landed).

import { beforeEach, describe, expect, test } from "vitest";
import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const transformSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("Transform", () => {
    const { TckTransformed } = entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("insert + find applies each direction exactly once", async () => {
      const repo = getHandle().repository(TckTransformed);

      const inserted = await repo.insert({ label: "a", suffixed: "abc", halved: 10 });

      // The value returned by insert is the entity as authored — untransformed.
      expect(inserted.suffixed).toBe("abc");
      expect(inserted.halved).toBe(10);

      const found = await repo.findOneOrFail({ id: inserted.id });
      expect(found.suffixed).toBe("abc");
      expect(found.halved).toBe(10);
    });

    test("re-reading the same row keeps the value stable", async () => {
      const repo = getHandle().repository(TckTransformed);

      const inserted = await repo.insert({ label: "b", suffixed: "abc", halved: 10 });

      const first = await repo.findOneOrFail({ id: inserted.id });
      const second = await repo.findOneOrFail({ id: inserted.id });

      expect(second.suffixed).toBe(first.suffixed);
      expect(second.halved).toBe(first.halved);
    });

    test("update applies each direction exactly once", async () => {
      const repo = getHandle().repository(TckTransformed);

      const inserted = await repo.insert({ label: "c", suffixed: "abc", halved: 10 });

      const entity = await repo.findOneOrFail({ id: inserted.id });
      entity.suffixed = "xyz";
      entity.halved = 24;
      await repo.update(entity);

      const found = await repo.findOneOrFail({ id: inserted.id });
      expect(found.suffixed).toBe("xyz");
      expect(found.halved).toBe(24);
    });

    test("updateMany applies each direction exactly once", async () => {
      const repo = getHandle().repository(TckTransformed);

      const inserted = await repo.insert({ label: "d", suffixed: "abc", halved: 10 });

      await repo.updateMany({ label: "d" }, { suffixed: "qrs", halved: 36 });

      const found = await repo.findOneOrFail({ id: inserted.id });
      expect(found.suffixed).toBe("qrs");
      expect(found.halved).toBe(36);
    });

    test("save applies each direction exactly once on both insert and update", async () => {
      const repo = getHandle().repository(TckTransformed);

      const saved = await repo.save({ label: "e", suffixed: "abc", halved: 10 });

      const found = await repo.findOneOrFail({ id: saved.id });
      expect(found.suffixed).toBe("abc");
      expect(found.halved).toBe(10);

      found.suffixed = "uvw";
      found.halved = 50;
      await repo.save(found);

      const again = await repo.findOneOrFail({ id: saved.id });
      expect(again.suffixed).toBe("uvw");
      expect(again.halved).toBe(50);
    });

    test("find returning many rows transforms each row exactly once", async () => {
      const repo = getHandle().repository(TckTransformed);

      await repo.insert({ label: "many", suffixed: "one", halved: 2 });
      await repo.insert({ label: "many", suffixed: "two", halved: 4 });

      const results = await repo.find({ label: "many" });
      const bySuffixed = results
        .slice()
        .sort((a, b) => a.suffixed.localeCompare(b.suffixed));

      expect(bySuffixed).toHaveLength(2);
      expect(bySuffixed[0].suffixed).toBe("one");
      expect(bySuffixed[0].halved).toBe(2);
      expect(bySuffixed[1].suffixed).toBe("two");
      expect(bySuffixed[1].halved).toBe(4);
    });
  });
};
