// TCK: Embedded List Loading Suite
//
// Tests the lazy/eager loading dispatch for @EmbeddedList fields:
//   - default: { single: "eager", multiple: "lazy" } (JPA-aligned)
//   - @Eager() / @Eager("multiple") forces load on list queries
//   - @Lazy("single") forces a thenable on findOne

import type { TckDriverHandle } from "./types";
import type { TckEntities } from "./create-tck-entities";
import { isLazyCollection } from "../../entity/utils/lazy-collection";

export const embeddedListLoadingSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  const { TckElDefault, TckElEagerMultiple, TckElLazySingle, TckElEager } = entities;

  beforeEach(async () => {
    await getHandle().clear();
  });

  // ─── E1: Default — findOne is eager ─────────────────────────────────

  test("default: findOne loads embedded list as plain array (eager single)", async () => {
    const repo = getHandle().repository(TckElDefault);
    const inserted = await repo.insert({ name: "alpha", tags: ["one", "two", "three"] });

    const found = await repo.findOne({ id: inserted.id });
    expect(found).not.toBeNull();
    expect(isLazyCollection(found!.tags)).toBe(false);
    expect(Array.isArray(found!.tags)).toBe(true);
    expect([...found!.tags].sort()).toEqual(["one", "three", "two"]);
  });

  // ─── E2: Default — find attaches a thenable ─────────────────────────

  test("default: find attaches LazyCollection thenable (lazy multiple)", async () => {
    const repo = getHandle().repository(TckElDefault);
    await repo.insert({ name: "beta", tags: ["red", "green"] });

    const rows = await repo.find();
    expect(rows).toHaveLength(1);
    expect(isLazyCollection(rows[0].tags)).toBe(true);

    const tags = await rows[0].tags;
    expect([...tags].sort()).toEqual(["green", "red"]);

    // After resolution, the thenable replaces itself
    expect(isLazyCollection(rows[0].tags)).toBe(false);
    expect([...rows[0].tags].sort()).toEqual(["green", "red"]);
  });

  // ─── E3: @Eager("multiple") — find loads eagerly ────────────────────

  test('@Eager("multiple"): find returns plain array, no thenable', async () => {
    const repo = getHandle().repository(TckElEagerMultiple);
    await repo.insert({ name: "gamma", tags: ["x", "y", "z"] });
    await repo.insert({ name: "delta", tags: ["only"] });

    const rows = await repo.find();
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(isLazyCollection(row.tags)).toBe(false);
      expect(Array.isArray(row.tags)).toBe(true);
    }
    const gamma = rows.find((r) => r.name === "gamma")!;
    const delta = rows.find((r) => r.name === "delta")!;
    expect([...gamma.tags].sort()).toEqual(["x", "y", "z"]);
    expect(delta.tags).toEqual(["only"]);
  });

  // ─── E4: @Lazy("single") — findOne returns a thenable ───────────────

  test('@Lazy("single"): findOne returns LazyCollection thenable', async () => {
    const repo = getHandle().repository(TckElLazySingle);
    const inserted = await repo.insert({ name: "epsilon", tags: ["aa", "bb"] });

    const found = await repo.findOne({ id: inserted.id });
    expect(found).not.toBeNull();
    expect(isLazyCollection(found!.tags)).toBe(true);

    const tags = await found!.tags;
    expect([...tags].sort()).toEqual(["aa", "bb"]);
    expect(isLazyCollection(found!.tags)).toBe(false);
  });

  // ─── E5: @Eager() (both scopes) — find and findOne both eager ──────

  test("@Eager(): both findOne and find return plain arrays", async () => {
    const repo = getHandle().repository(TckElEager);
    const inserted = await repo.insert({ name: "zeta", tags: ["m", "n"] });

    const found = await repo.findOne({ id: inserted.id });
    expect(found).not.toBeNull();
    expect(isLazyCollection(found!.tags)).toBe(false);
    expect([...found!.tags].sort()).toEqual(["m", "n"]);

    const rows = await repo.find();
    expect(rows).toHaveLength(1);
    expect(isLazyCollection(rows[0].tags)).toBe(false);
    expect([...rows[0].tags].sort()).toEqual(["m", "n"]);
  });

  // ─── E6: Empty embedded list — lazy resolves to [] ─────────────────

  test("default: find resolves an empty lazy collection to []", async () => {
    const repo = getHandle().repository(TckElDefault);
    await repo.insert({ name: "empty", tags: [] });

    const rows = await repo.find();
    expect(rows).toHaveLength(1);
    expect(isLazyCollection(rows[0].tags)).toBe(true);

    const tags = await rows[0].tags;
    expect(tags).toEqual([]);
  });
};
