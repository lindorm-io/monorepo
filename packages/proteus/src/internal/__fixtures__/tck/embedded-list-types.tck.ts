import { beforeEach, describe, expect, test } from "vitest";
// TCK: Embedded List Element Types Suite
//
// A collection-table row is written by the same rules as an entity row: the
// element value goes through `transform.to`, then the driver's own write
// coercion, and the read is the exact inverse (`deserialise`, then
// `transform.from`).
//
// Every driver used to hand-roll the write half as a bare `transform.to` with
// NO coercion — so a `timestamp` element reached better-sqlite3 as a live Date
// (which it refuses to bind), a `boolean` reached it as a JS boolean, and MySQL
// got an ISO-8601 string it rejects for DATETIME. The primitive branch pushed
// the element verbatim, skipping the transform too.

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const embeddedListTypesSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("EmbeddedList element types", () => {
    const { TckElTyped, TckElItem } = entities;

    const recordedAt = new Date("2024-03-05T10:15:30.000Z");
    const otherAt = new Date("2021-11-30T23:45:00.000Z");

    const makeItem = (
      label: string,
      quantity: number,
      active: boolean,
      at: Date,
    ): InstanceType<typeof TckElItem> => {
      const item = new TckElItem();
      item.label = label;
      item.suffixed = label;
      item.quantity = quantity;
      item.active = active;
      item.recordedAt = at;
      return item;
    };

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("embeddable elements round-trip every column type", async () => {
      const repo = getHandle().repository(TckElTyped);
      const inserted = await repo.insert({
        name: "typed",
        items: [
          makeItem("first", 7, true, recordedAt),
          makeItem("second", 0, false, otherAt),
        ],
        stamps: [],
      });

      const found = await repo.findOne({ id: inserted.id });
      expect(found).not.toBeNull();
      expect(found!.items).toHaveLength(2);

      const [first, second] = found!.items;

      expect(first.label).toBe("first");
      expect(first.quantity).toBe(7);
      expect(first.active).toBe(true);
      expect(first.recordedAt).toBeInstanceOf(Date);
      expect(first.recordedAt.toISOString()).toBe(recordedAt.toISOString());

      expect(second.label).toBe("second");
      expect(second.quantity).toBe(0);
      expect(second.active).toBe(false);
      expect(second.recordedAt.toISOString()).toBe(otherAt.toISOString());
    });

    test("an element @Transform is applied exactly once in each direction", async () => {
      const repo = getHandle().repository(TckElTyped);
      const inserted = await repo.insert({
        name: "transformed",
        items: [makeItem("alpha", 1, true, recordedAt)],
        stamps: [],
      });

      // The transform is non-idempotent: a layer applying `to` twice stores
      // "alpha##" and hands back "alpha#", one applying `from` twice hands back
      // "alph". Only a single application in each direction lands on "alpha".
      const found = await repo.findOne({ id: inserted.id });
      expect(found!.items[0].suffixed).toBe("alpha");
      expect(found!.items[0].label).toBe("alpha");
    });

    test("primitive timestamp elements round-trip as Dates in order", async () => {
      const repo = getHandle().repository(TckElTyped);
      const inserted = await repo.insert({
        name: "stamped",
        items: [],
        stamps: [recordedAt, otherAt],
      });

      const found = await repo.findOne({ id: inserted.id });
      expect(found!.stamps).toHaveLength(2);
      for (const stamp of found!.stamps) {
        expect(stamp).toBeInstanceOf(Date);
      }
      expect(found!.stamps.map((s) => s.toISOString())).toEqual([
        recordedAt.toISOString(),
        otherAt.toISOString(),
      ]);
    });

    test("a re-save replaces the collection rows and still round-trips", async () => {
      const repo = getHandle().repository(TckElTyped);
      const inserted = await repo.insert({
        name: "resaved",
        items: [makeItem("one", 1, true, recordedAt)],
        stamps: [recordedAt],
      });

      inserted.name = "resaved-again";
      inserted.items = [makeItem("two", 2, false, otherAt)];
      inserted.stamps = [otherAt];
      await repo.save(inserted);

      const found = await repo.findOne({ id: inserted.id });
      expect(found!.items).toHaveLength(1);
      expect(found!.items[0].label).toBe("two");
      expect(found!.items[0].suffixed).toBe("two");
      expect(found!.items[0].active).toBe(false);
      expect(found!.items[0].recordedAt.toISOString()).toBe(otherAt.toISOString());
      expect(found!.stamps.map((s) => s.toISOString())).toEqual([otherAt.toISOString()]);
    });

    test("empty collections round-trip as empty arrays", async () => {
      const repo = getHandle().repository(TckElTyped);
      const inserted = await repo.insert({ name: "empty", items: [], stamps: [] });

      const found = await repo.findOne({ id: inserted.id });
      expect(found!.items).toEqual([]);
      expect(found!.stamps).toEqual([]);
    });
  });
};
