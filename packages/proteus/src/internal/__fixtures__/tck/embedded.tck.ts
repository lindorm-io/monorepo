import { beforeEach, describe, expect, test } from "vitest";
// TCK: Embedded Suite
//
// @Embedded flattens an @Embeddable into the parent row under DOTTED field keys
// ("address.city") while the hydrated entity carries a nested object — every
// write-side consumer has to read the nested object, not the dotted key.
// The CachingRepository serializer did not, so it cached `undefined` for every
// embedded column: a cache MISS returned the address, a cache HIT returned
// `address: null`. Reading twice is what catches that — a single read passes
// either way.

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const embeddedSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("Embedded", () => {
    const { TckWithAddress } = entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("findOne round-trips an embedded object", async () => {
      const repo = getHandle().repository(TckWithAddress);
      const inserted = await repo.insert({
        name: "with-address",
        address: { street: "Karl Johans gate 1", city: "Oslo", country: "NO" },
      });

      const found = await repo.findOne({ id: inserted.id });
      expect(found).not.toBeNull();
      expect(found!.address).toEqual({
        street: "Karl Johans gate 1",
        city: "Oslo",
        country: "NO",
      });
    });

    test("a second read returns the same embedded object as the first", async () => {
      const repo = getHandle().repository(TckWithAddress);
      const inserted = await repo.insert({
        name: "cached-address",
        address: { street: "Storgata 2", city: "Bergen", country: "NO" },
      });

      // First read is a cache MISS (it populates the store), second is a HIT.
      // Both must agree, and neither may be null — a HIT that dropped every
      // embedded column also "agrees" with itself, so the non-null assertion
      // is the half that matters.
      const first = await repo.findOne({ id: inserted.id });
      const second = await repo.findOne({ id: inserted.id });

      expect(first!.address).not.toBeNull();
      expect(second!.address).not.toBeNull();
      expect(second!.address).toEqual(first!.address);
      expect(second!.address!.city).toBe("Bergen");
    });

    test("a second find() returns the same embedded object as the first", async () => {
      const repo = getHandle().repository(TckWithAddress);
      await repo.insert({
        name: "cached-list",
        address: { street: "Dronningens gate 3", city: "Trondheim", country: "NO" },
      });

      const first = await repo.find({ name: "cached-list" });
      const second = await repo.find({ name: "cached-list" });

      expect(first[0].address).not.toBeNull();
      expect(second[0].address).not.toBeNull();
      expect(second[0].address).toEqual(first[0].address);
    });

    test("a null embedded object round-trips as null on both reads", async () => {
      const repo = getHandle().repository(TckWithAddress);
      const inserted = await repo.insert({ name: "no-address", address: null });

      const first = await repo.findOne({ id: inserted.id });
      const second = await repo.findOne({ id: inserted.id });

      expect(first!.address).toBeNull();
      expect(second!.address).toBeNull();
    });
  });
};
