import { test, it, expect, beforeEach } from "vitest";
// TCK: Embedded List Loading Suite
//
// Tests the lazy/eager loading dispatch for @EmbeddedList fields:
//   - default: { single: "eager", multiple: "lazy" } (JPA-aligned)
//   - @Eager() / @Eager("multiple") forces load on list queries
//   - @Lazy("single") forces a thenable on findOne

import type { TckDriverHandle } from "./types";
import type { TckEntities } from "./create-tck-entities";
import { isLazyCollection } from "../../entity/utils/lazy-collection";
import {
  getLazyEmbeddedListLoaderInvocations,
  resetLazyEmbeddedListLoaderInvocations,
} from "../../entity/utils/install-lazy-embedded-lists";

export const embeddedListLoadingSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  const { TckElDefault, TckElEagerMultiple, TckElLazySingle, TckElEager } = entities;

  beforeEach(async () => {
    await getHandle().clear();
    resetLazyEmbeddedListLoaderInvocations();
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

  // ─── E7: Proof of laziness — loader counter ─────────────────────────
  //
  // Verifies that `find()` does NOT eagerly load lazy embedded lists.
  // The counter increments once per deferred loader invocation, proving
  // the load was actually deferred (not eagerly pre-loaded and wrapped in
  // a thenable shell, which would pass E2's isLazyCollection assertions).

  test("lazy find: loader counter is zero until first await", async () => {
    const repo = getHandle().repository(TckElDefault);
    await repo.insert({ name: "a", tags: ["a1", "a2"] });
    await repo.insert({ name: "b", tags: ["b1", "b2", "b3"] });
    await repo.insert({ name: "c", tags: ["c1"] });

    const rows = await repo.find();
    expect(rows).toHaveLength(3);

    // No row has been awaited yet — zero loader calls.
    expect(getLazyEmbeddedListLoaderInvocations()).toBe(0);
    for (const row of rows) {
      expect(isLazyCollection(row.tags)).toBe(true);
    }

    // Awaiting the first row triggers exactly one loader call.
    await rows[0].tags;
    expect(getLazyEmbeddedListLoaderInvocations()).toBe(1);

    // Awaiting the second row triggers one more.
    await rows[1].tags;
    expect(getLazyEmbeddedListLoaderInvocations()).toBe(2);

    // The first row's resolved value must not have triggered any
    // follow-up load — re-reading it is a plain array access.
    expect(isLazyCollection(rows[0].tags)).toBe(false);
    expect(Array.isArray(rows[0].tags)).toBe(true);
  });

  // ─── E8: Double-await caching — loader fires exactly once ───────────

  test("lazy find: double-await the same row increments the counter once", async () => {
    const repo = getHandle().repository(TckElDefault);
    await repo.insert({ name: "once", tags: ["x", "y", "z"] });

    const rows = await repo.find();
    expect(rows).toHaveLength(1);
    expect(getLazyEmbeddedListLoaderInvocations()).toBe(0);

    // Capture the thenable identity before the first await — the first
    // await replaces the property with the resolved array.
    const thenable = rows[0].tags;
    expect(isLazyCollection(thenable)).toBe(true);

    const firstAwait = await thenable;
    expect([...firstAwait].sort()).toEqual(["x", "y", "z"]);
    expect(getLazyEmbeddedListLoaderInvocations()).toBe(1);

    // Awaiting the same LazyCollection instance again must resolve from
    // cache — the loader is NOT invoked a second time.
    const secondAwait = await thenable;
    expect([...secondAwait].sort()).toEqual(["x", "y", "z"]);
    expect(getLazyEmbeddedListLoaderInvocations()).toBe(1);
  });

  // ─── E9: Save-time preservation — lazy insert round-trips ──────────

  test('@Lazy("single") insert with populated array preserves the values on reload', async () => {
    const repo = getHandle().repository(TckElLazySingle);
    const inserted = await repo.insert({
      name: "preserved",
      tags: ["one", "two", "three"],
    });

    // The insert path does not need to invoke the lazy loader — the
    // user-provided array is persisted directly, not wrapped-and-discarded.
    expect(Array.isArray(inserted.tags)).toBe(true);
    expect([...inserted.tags].sort()).toEqual(["one", "three", "two"]);

    // Reset the counter so the reload assertions are isolated.
    resetLazyEmbeddedListLoaderInvocations();

    const found = await repo.findOne({ id: inserted.id });
    expect(found).not.toBeNull();
    expect(isLazyCollection(found!.tags)).toBe(true);
    expect(getLazyEmbeddedListLoaderInvocations()).toBe(0);

    const tags = await found!.tags;
    expect([...tags].sort()).toEqual(["one", "three", "two"]);
    expect(getLazyEmbeddedListLoaderInvocations()).toBe(1);
  });
};
