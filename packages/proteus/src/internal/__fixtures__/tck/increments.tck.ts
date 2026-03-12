// TCK: Increments Suite
// Tests increment and decrement operations.

import type { TckDriverHandle } from "./types";
import type { TckEntities } from "./create-tck-entities";

export const incrementsSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  const { TckSimpleUser } = entities;

  beforeEach(async () => {
    await getHandle().clear();
  });

  test("increment increases field value atomically", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    const entity = await repo.insert({ name: "Inc", age: 10 });

    await repo.increment({ id: entity.id }, "age", 5);

    const found = await repo.findOne({ id: entity.id });
    expect(found!.age).toBe(15);
  });

  test("decrement decreases field value atomically", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    const entity = await repo.insert({ name: "Dec", age: 10 });

    await repo.decrement({ id: entity.id }, "age", 3);

    const found = await repo.findOne({ id: entity.id });
    expect(found!.age).toBe(7);
  });

  test("increment on non-existent criteria is a no-op", async () => {
    const repo = getHandle().repository(TckSimpleUser);

    // Should not throw — matches SQL UPDATE semantics (zero rows affected = success)
    await expect(
      repo.increment({ id: "00000000-0000-0000-0000-000000000000" }, "age", 1),
    ).resolves.toBeUndefined();
  });

  test("increment applies to all matching entities", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    await repo.insert({ name: "Same", age: 10 });
    await repo.insert({ name: "Same", age: 20 });

    await repo.increment({ name: "Same" }, "age", 5);

    const results = await repo.find({ name: "Same" }, { order: { age: "ASC" } });
    expect(results[0].age).toBe(15);
    expect(results[1].age).toBe(25);
  });

  // A34: decrement below zero

  test("decrement below zero produces negative value", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    const entity = await repo.insert({ name: "NegDec", age: 2 });

    await repo.decrement({ id: entity.id }, "age", 5);

    const found = await repo.findOne({ id: entity.id });
    expect(found!.age).toBe(-3);
  });
};
