// TCK: Change Detection Suite
//
// ⭐ Does an IN-PLACE mutation actually reach the database?
//
// `update()` writes only the columns that differ from the snapshot taken when
// the entity was hydrated. That snapshot used to hold the entity's OWN objects
// by reference, so mutating one in place — `entity.address.street = "x"`, a
// `push` onto an array, `date.setFullYear(...)` — mutated the snapshot with it.
// The differ then compared the object with itself, found nothing changed, and
// the update wrote nothing, raised nothing and bumped no version. Replacing a
// value wholesale (`entity.meta = {…}`) kept working the whole time, which is
// why the loss went unnoticed.
//
// A unit test over the differ CANNOT reproduce that: hand-building two distinct
// objects is precisely the aliasing that real hydration creates and a fixture
// does not. So every test here hydrates through a real driver, mutates in
// place, calls `update()`, and re-reads the row.
//
// The version assertion is the load-bearing half. A re-read alone can pass on a
// driver that hands back a cached or aliased object; a bumped @VersionField
// proves a row was really written.

import { beforeEach, describe, expect, test } from "vitest";
import type { ProteusSource } from "../../../classes/ProteusSource.js";
import type { UpdateEvent } from "../../../interfaces/index.js";
import type { TckCapabilities, TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const changeDetectionSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
  getSource: () => ProteusSource,
  caps: TckCapabilities,
) => {
  describe("ChangeDetection", () => {
    const {
      TckArrayHolder,
      TckArrayTypes,
      TckJsonHolder,
      TckTypedJson,
      TckTypeHolder,
      TckWithAddress,
    } = entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("an @Embedded nested value mutated in place is written", async () => {
      const repo = getHandle().repository(TckWithAddress);
      const inserted = await repo.insert({
        name: "embedded-in-place",
        address: { street: "Old St", city: "Oslo", country: "NO" },
      });

      const loaded = (await repo.findOne({ id: inserted.id }))!;
      loaded.address!.street = "New St";
      const updated = await repo.update(loaded);

      const persisted = (await repo.findOne({ id: inserted.id }))!;
      expect(persisted.address!.street).toBe("New St");
      expect(persisted.version).toBe(inserted.version + 1);
      expect(updated.version).toBe(inserted.version + 1);
    });

    test("a json object mutated in place is written", async () => {
      const repo = getHandle().repository(TckJsonHolder);
      const inserted = await repo.insert({
        metadata: { tier: "old" },
        settings: { theme: "dark", count: 1 },
        payload: { items: ["a"], count: 1 },
      });

      const loaded = (await repo.findOne({ id: inserted.id }))!;
      (loaded.metadata as { tier: string }).tier = "new";
      await repo.update(loaded);

      const persisted = (await repo.findOne({ id: inserted.id }))!;
      expect(persisted.metadata).toEqual({ tier: "new" });
      expect(persisted.version).toBe(inserted.version + 1);
    });

    test("a value nested inside a json object is written", async () => {
      const repo = getHandle().repository(TckJsonHolder);
      const inserted = await repo.insert({
        metadata: { tier: "gold" },
        settings: { theme: "dark", count: 1 },
        payload: { items: ["a"], count: 1 },
      });

      // One level below the column value — a shallow copy of the snapshot
      // would still alias this and lose the write.
      const loaded = (await repo.findOne({ id: inserted.id }))!;
      loaded.payload.items.push("b");
      await repo.update(loaded);

      const persisted = (await repo.findOne({ id: inserted.id }))!;
      expect(persisted.payload.items).toEqual(["a", "b"]);
      expect(persisted.version).toBe(inserted.version + 1);
    });

    test("an array field mutated in place is written", async () => {
      const repo = getHandle().repository(TckArrayHolder);
      const inserted = await repo.insert({
        tags: ["a"],
        scores: [1],
        extras: null,
        labels: [],
      });

      const loaded = (await repo.findOne({ id: inserted.id }))!;
      loaded.tags.push("b");
      await repo.update(loaded);

      const persisted = (await repo.findOne({ id: inserted.id }))!;
      expect(persisted.tags).toEqual(["a", "b"]);
      expect(persisted.version).toBe(inserted.version + 1);
    });

    test("a Date inside an array field mutated in place is written", async () => {
      const repo = getHandle().repository(TckArrayTypes);
      const inserted = await repo.insert({
        timestamps: [new Date("2020-01-01T00:00:00.000Z")],
        dates: [new Date("2020-01-01T00:00:00.000Z")],
        integers: [1],
        smallints: [1],
        floats: [1.5],
        reals: [1.5],
        booleans: [true],
        strings: ["a"],
        uuids: ["b0a1c2d3-e4f5-4678-89ab-cdef01234567"],
        decimals: [1.25],
        bigints: [1n],
      });

      // A Date is mutable in place, so it aliases exactly like an object does.
      const loaded = (await repo.findOne({ id: inserted.id }))!;
      loaded.timestamps[0].setUTCFullYear(2031);
      await repo.update(loaded);

      const persisted = (await repo.findOne({ id: inserted.id }))!;
      expect(persisted.timestamps[0].getUTCFullYear()).toBe(2031);
      expect(persisted.version).toBe(inserted.version + 1);
    });

    test("an entity with nothing changed still writes nothing", async () => {
      const repo = getHandle().repository(TckJsonHolder);
      const inserted = await repo.insert({
        metadata: { tier: "gold" },
        settings: { theme: "dark", count: 1 },
        payload: { items: ["a"], count: 1 },
      });

      // The other half of the contract: detaching the snapshot must not turn
      // every no-op update into a write. A bumped version here would mean the
      // copy compares unequal to the value it was copied from.
      const loaded = (await repo.findOne({ id: inserted.id }))!;
      await repo.update(loaded);

      const persisted = (await repo.findOne({ id: inserted.id }))!;
      expect(persisted.version).toBe(inserted.version);
    });

    test("the update event reports the PRIOR nested value of an @Embedded field", async () => {
      const repo = getHandle().repository(TckWithAddress);
      const inserted = await repo.insert({
        name: "old-entity",
        address: { street: "Old St", city: "Oslo", country: "NO" },
      });

      const events: Array<UpdateEvent> = [];
      const listener = (event: UpdateEvent) => events.push(event);
      const source = getSource();
      source.on("entity:after-update", listener);

      try {
        const loaded = (await repo.findOne({ id: inserted.id }))!;
        loaded.address!.street = "New St";
        await repo.update(loaded);
      } finally {
        source.off("entity:after-update", listener);
      }

      expect(events).toHaveLength(1);
      expect(events[0].oldEntity!.address.street).toBe("Old St");
      expect(events[0].entity.address.street).toBe("New St");
    });

    if (caps.typedJson) {
      test("a @TypedJson payload mutated in place is written", async () => {
        const repo = getHandle().repository(TckTypedJson);
        const inserted = await repo.insert({
          name: "typed-in-place",
          payload: { tier: "old" },
          meta: { kind: "a" },
          optional: null,
          transformed: null,
        });

        const loaded = (await repo.findOne({ id: inserted.id }))!;
        (loaded.payload as { tier: string }).tier = "new";
        await repo.update(loaded);

        const persisted = (await repo.findOne({ id: inserted.id }))!;
        expect(persisted.payload).toEqual({ tier: "new" });
        expect(persisted.version).toBe(inserted.version + 1);
      });
    }

    if (caps.binaryColumns) {
      test("a Buffer field mutated in place is written", async () => {
        const repo = getHandle().repository(TckTypeHolder);
        const inserted = await repo.insert({
          bigValue: null,
          decimalValue: null,
          decimalStringValue: null,
          binaryValue: Buffer.from("old"),
        });

        const loaded = (await repo.findOne({ id: inserted.id }))!;
        loaded.binaryValue!.write("new");
        await repo.update(loaded);

        const persisted = (await repo.findOne({ id: inserted.id }))!;
        expect(persisted.binaryValue!.toString()).toBe("new");
        expect(persisted.version).toBe(inserted.version + 1);
      });
    }
  });
};
