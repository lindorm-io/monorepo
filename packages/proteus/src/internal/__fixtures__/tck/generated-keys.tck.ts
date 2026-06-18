import { describe, test, expect, beforeEach } from "vitest";
// TCK: Generated Primary Key Strategies Suite
// Exercises one of each @Generated identity strategy as a primary key across
// every driver: lindorm_id, uuid, string, increment, integer.

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

const LINDORM_ID = /^[A-Za-z0-9]{24}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const generatedKeysSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("GeneratedKeys", () => {
    const { TckHooked, TckSimpleUser, TckPkString, TckPkIncrement, TckPkInteger } =
      entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("lindorm_id PK is a 24-char base62 string and round-trips", async () => {
      const repo = getHandle().repository(TckHooked);
      const inserted = await repo.insert({ name: "lindorm" });

      expect(typeof inserted.id).toBe("string");
      expect(inserted.id).toMatch(LINDORM_ID);

      const found = await repo.findOne({ id: inserted.id });
      expect(found!.id).toBe(inserted.id);
    });

    test("uuid PK is a uuid string and round-trips", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const inserted = await repo.insert({ name: "uuid" });

      expect(typeof inserted.id).toBe("string");
      expect(inserted.id).toMatch(UUID);

      const found = await repo.findOne({ id: inserted.id });
      expect(found!.id).toBe(inserted.id);
    });

    test("string PK is a non-empty string and round-trips", async () => {
      const repo = getHandle().repository(TckPkString);
      const inserted = await repo.insert({ label: "string" });

      expect(typeof inserted.id).toBe("string");
      expect(inserted.id.length).toBeGreaterThan(0);

      const found = await repo.findOne({ id: inserted.id });
      expect(found!.id).toBe(inserted.id);
      expect(found!.label).toBe("string");
    });

    test("increment PK is a number assigned by the driver and round-trips", async () => {
      const repo = getHandle().repository(TckPkIncrement);
      const first = await repo.insert({ label: "first" });
      const second = await repo.insert({ label: "second" });

      expect(typeof first.id).toBe("number");
      expect(typeof second.id).toBe("number");
      expect(second.id).toBeGreaterThan(first.id);

      const found = await repo.findOne({ id: first.id });
      expect(found!.id).toBe(first.id);
      expect(found!.label).toBe("first");
    });

    test("integer PK is a client-side random number and round-trips", async () => {
      const repo = getHandle().repository(TckPkInteger);
      const inserted = await repo.insert({ label: "integer" });

      expect(typeof inserted.id).toBe("number");
      expect(Number.isInteger(inserted.id)).toBe(true);

      const found = await repo.findOne({ id: inserted.id });
      expect(found!.id).toBe(inserted.id);
      expect(found!.label).toBe("integer");
    });
  });
};
