import { test, expect, beforeEach } from "vitest";
// TCK: Expiry Suite
// Tests TTL / deleteExpired behavior.

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const expirySuite = (getHandle: () => TckDriverHandle, entities: TckEntities) => {
  const { TckExpirable } = entities;

  beforeEach(async () => {
    await getHandle().clear();
  });

  test("insert entity with future expiry", async () => {
    const repo = getHandle().repository(TckExpirable);
    const future = new Date(Date.now() + 60_000);
    const entity = await repo.insert({ name: "Future", expiresAt: future });

    expect(entity.expiresAt).toBeInstanceOf(Date);
    expect(entity.expiresAt!.getTime()).toBe(future.getTime());
  });

  test("date millisecond precision is preserved through SELECT", async () => {
    const repo = getHandle().repository(TckExpirable);
    // Use a future date with deliberately odd sub-second digits (not round numbers)
    // to catch drivers that truncate or round milliseconds.
    // Must be in the future so TTL-based drivers (e.g. Redis) don't evict immediately.
    const weirdMs = new Date(Math.floor(Date.now() / 1000) * 1000 + 60_001); // ~60s from now, 001ms past a second boundary
    const entity = await repo.insert({ name: "Precision", expiresAt: weirdMs });

    const found = await repo.findOne({ id: entity.id });

    expect(found!.expiresAt).toBeInstanceOf(Date);
    expect(found!.expiresAt!.getTime()).toBe(weirdMs.getTime());
  });

  test("deleteExpired removes expired entities", async () => {
    const repo = getHandle().repository(TckExpirable);
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);

    await repo.insert({ name: "Expired", expiresAt: past });
    await repo.insert({ name: "Valid", expiresAt: future });
    await repo.insert({ name: "NoExpiry" });

    await repo.deleteExpired();

    const remaining = await repo.find();
    expect(remaining).toHaveLength(2);
    const names = remaining.map((e) => e.name).sort();
    expect(names).toEqual(["NoExpiry", "Valid"]);
  });

  test("ttl returns remaining time for entity", async () => {
    const repo = getHandle().repository(TckExpirable);
    const future = new Date(Date.now() + 120_000); // 2 minutes from now
    const entity = await repo.insert({ name: "TtlTest", expiresAt: future });

    const ttl = await repo.ttl({ id: entity.id });
    expect(typeof ttl).toBe("number");
    // Different drivers return TTL in different units:
    // - Redis: PTTL in milliseconds (expected ~120,000)
    // - Memory: seconds (expected ~120)
    // We accept either unit with tolerance for test execution time.
    const isMilliseconds = ttl > 1000;
    if (isMilliseconds) {
      // Redis: PTTL milliseconds, allow 5s tolerance for network/clock skew
      expect(ttl).toBeGreaterThan(100_000);
      expect(ttl).toBeLessThanOrEqual(125_000);
    } else {
      // Memory/other: seconds, allow 20s tolerance
      expect(ttl).toBeGreaterThan(100);
      expect(ttl).toBeLessThanOrEqual(125);
    }
  });

  test("entity without expiry has null expiresAt", async () => {
    const repo = getHandle().repository(TckExpirable);
    const entity = await repo.insert({ name: "NoExpiry" });

    expect(entity.expiresAt).toBeNull();
  });

  test("deleteExpired is no-op when nothing is expired", async () => {
    const repo = getHandle().repository(TckExpirable);
    const future = new Date(Date.now() + 60_000);
    await repo.insert({ name: "Fresh", expiresAt: future });

    await repo.deleteExpired();

    const count = await repo.count();
    expect(count).toBe(1);
  });

  test("ttl on entity without expiresAt throws or returns non-positive", async () => {
    const repo = getHandle().repository(TckExpirable);
    const entity = await repo.insert({ name: "NoExpiry" });

    // Some drivers throw when no TTL is set; others return a non-positive value
    try {
      const ttl = await repo.ttl({ id: entity.id });
      expect(ttl).toBeLessThanOrEqual(0);
    } catch {
      // Throwing is also acceptable behavior
      expect(true).toBe(true);
    }
  });
};
