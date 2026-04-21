import { describe, test, expect, beforeEach } from "vitest";
// TCK: Aggregates Suite
// Tests sum, average, minimum, maximum.

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const aggregatesSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("Aggregates", () => {
    const { TckSimpleUser } = entities;

    beforeEach(async () => {
      await getHandle().clear();
      const repo = getHandle().repository(TckSimpleUser);
      await repo.insert({ name: "A", age: 10 });
      await repo.insert({ name: "B", age: 20 });
      await repo.insert({ name: "C", age: 30 });
      await repo.insert({ name: "D", age: 40 });
    });

    test("sum returns total of field values", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.sum("age");
      expect(result).toBe(100);
    });

    test("sum with criteria filters before aggregating", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.sum("age", { name: "A" });
      expect(result).toBe(10);
    });

    test("average returns mean of field values", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.average("age");
      expect(result).toBe(25);
    });

    test("minimum returns lowest field value", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.minimum("age");
      expect(result).toBe(10);
    });

    test("maximum returns highest field value", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.maximum("age");
      expect(result).toBe(40);
    });

    test("sum returns null for empty result set", async () => {
      await getHandle().clear();
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.sum("age");
      expect(result).toBeNull();
    });

    test("average returns null for empty result set", async () => {
      await getHandle().clear();
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.average("age");
      expect(result).toBeNull();
    });

    test("minimum returns null for empty result set", async () => {
      await getHandle().clear();
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.minimum("age");
      expect(result).toBeNull();
    });

    test("maximum returns null for empty result set", async () => {
      await getHandle().clear();
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.maximum("age");
      expect(result).toBeNull();
    });

    test("average with criteria filters before aggregating", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.average("age", { name: "A" });
      expect(result).toBe(10);
    });

    test("minimum with criteria filters before aggregating", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.minimum("age", { name: "A" });
      expect(result).toBe(10);
    });

    test("maximum with criteria filters before aggregating", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const result = await repo.maximum("age", { name: "D" });
      expect(result).toBe(40);
    });
  });
};
