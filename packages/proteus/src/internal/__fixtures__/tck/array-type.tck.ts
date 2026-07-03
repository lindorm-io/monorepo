import { beforeEach, describe, expect, test } from "vitest";
// TCK: Typed Array Round-Trip Suite
//
// Ungated — runs on EVERY driver (memory/sqlite/mysql/postgres/mongo/redis).
// A `@Field("array", { arrayType: X })` must round-trip symmetrically: whatever
// the driver serialises on write it must hydrate back to the SAME JS type and
// value on read, regardless of how the driver physically stores the array
// (Postgres native `type[]`, SQLite/MySQL/Redis JSON string, Mongo BSON, Memory
// structuredClone). This is the whole reason the write side serialises bigint →
// string and Date → ISO where native storage would otherwise corrupt or throw.

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

// Values chosen to be exact across every backing store:
// - reals/decimals use dyadic/short fractions (exact in float4 / double / NUMERIC)
// - integers/smallints stay inside int32 / int16 range
// - bigints exceed Number.MAX_SAFE_INTEGER to prove true 64-bit fidelity
const timestamps = [
  new Date("2024-01-15T12:00:00.000Z"),
  new Date("2024-02-20T08:30:45.123Z"),
];
const dates = [
  new Date("2024-03-10T00:00:00.000Z"),
  new Date("2024-07-01T00:00:00.000Z"),
];
const integers = [1, 2147483647, -2147483648];
const smallints = [1, 32767, -32768];
const floats = [1.5, 2.25, -0.5];
const reals = [1.5, 2.25, -0.5];
const booleans = [true, false, true];
const strings = ["alpha", "beta", ""];
const uuids = [
  "550e8400-e29b-41d4-a716-446655440000",
  "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
];
const decimals = [1.5, 2.25, 100];
const bigints = [9007199254740993n, -9007199254740993n, 10n];

const seed = () => ({
  timestamps,
  dates,
  integers,
  smallints,
  floats,
  reals,
  booleans,
  strings,
  uuids,
  decimals,
  bigints,
});

// Postgres DATE columns store no time-of-day, so compare `date` arrays on the
// UTC calendar day only; every other driver preserves the full instant. All
// other element types are asserted for exact value AND JS type.
const assertRoundTrip = (found: any) => {
  expect(Array.isArray(found.timestamps)).toBe(true);
  expect(found.timestamps.every((d: unknown) => d instanceof Date)).toBe(true);
  expect(found.timestamps).toEqual(timestamps);

  expect(found.dates.every((d: unknown) => d instanceof Date)).toBe(true);
  expect(found.dates.map((d: Date) => d.toISOString().slice(0, 10))).toEqual([
    "2024-03-10",
    "2024-07-01",
  ]);

  expect(found.integers.every((n: unknown) => typeof n === "number")).toBe(true);
  expect(found.integers).toEqual(integers);

  expect(found.smallints.every((n: unknown) => typeof n === "number")).toBe(true);
  expect(found.smallints).toEqual(smallints);

  expect(found.floats.every((n: unknown) => typeof n === "number")).toBe(true);
  expect(found.floats).toEqual(floats);

  expect(found.reals.every((n: unknown) => typeof n === "number")).toBe(true);
  expect(found.reals).toEqual(reals);

  expect(found.booleans.every((b: unknown) => typeof b === "boolean")).toBe(true);
  expect(found.booleans).toEqual(booleans);

  expect(found.strings.every((s: unknown) => typeof s === "string")).toBe(true);
  expect(found.strings).toEqual(strings);

  expect(found.uuids.every((s: unknown) => typeof s === "string")).toBe(true);
  expect(found.uuids).toEqual(uuids);

  expect(found.decimals.every((n: unknown) => typeof n === "number")).toBe(true);
  expect(found.decimals).toEqual(decimals);

  expect(found.bigints.every((b: unknown) => typeof b === "bigint")).toBe(true);
  expect(found.bigints).toEqual(bigints);
};

export const arrayTypeSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("Typed Array Round-Trip", () => {
    const { TckArrayTypes } = entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("every arrayType round-trips to the same JS type + value on insert", async () => {
      const repo = getHandle().repository(TckArrayTypes);

      const inserted = await repo.insert(seed());
      const found = await repo.findOneOrFail({ id: inserted.id });

      assertRoundTrip(found);
    });

    test("every arrayType round-trips after an update (update write path)", async () => {
      const repo = getHandle().repository(TckArrayTypes);

      // Insert placeholder single-element arrays, then overwrite with the full
      // set so the update write path (not just insert) is exercised per driver.
      const inserted = await repo.insert({
        timestamps: [new Date("2020-01-01T00:00:00.000Z")],
        dates: [new Date("2020-01-01T00:00:00.000Z")],
        integers: [0],
        smallints: [0],
        floats: [0],
        reals: [0],
        booleans: [false],
        strings: ["x"],
        uuids: ["00000000-0000-0000-0000-000000000000"],
        decimals: [0],
        bigints: [0n],
      });

      const loaded = await repo.findOneOrFail({ id: inserted.id });
      Object.assign(loaded, seed());
      await repo.update(loaded);

      const found = await repo.findOneOrFail({ id: inserted.id });
      assertRoundTrip(found);
    });

    test("empty typed arrays round-trip as empty arrays", async () => {
      const repo = getHandle().repository(TckArrayTypes);

      const inserted = await repo.insert({
        timestamps: [],
        dates: [],
        integers: [],
        smallints: [],
        floats: [],
        reals: [],
        booleans: [],
        strings: [],
        uuids: [],
        decimals: [],
        bigints: [],
      });
      const found = (await repo.findOneOrFail({ id: inserted.id })) as any;

      for (const key of Object.keys(seed())) {
        expect(Array.isArray(found[key])).toBe(true);
        expect(found[key]).toHaveLength(0);
      }
    });
  });
};
