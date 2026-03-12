// TCK: Complex Predicates Suite
// Tests $all, $overlap, $contained, $length, $has, and embedded criteria.

import type { TckDriverHandle } from "./types";
import type { TckEntities } from "./create-tck-entities";

export const complexPredicatesSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("Complex Predicates", () => {
    // ─── Array operators on TckArrayHolder ─────────────────────────────

    describe("Array operators", () => {
      const { TckArrayHolder } = entities;

      beforeEach(async () => {
        await getHandle().clear();
      });

      describe("$all — array contains all required elements", () => {
        beforeEach(async () => {
          const repo = getHandle().repository(TckArrayHolder);
          await repo.insert({ tags: ["a", "b", "c"], scores: [1, 2, 3], extras: null });
          await repo.insert({ tags: ["a", "b"], scores: [4, 5], extras: ["x"] });
          await repo.insert({ tags: ["a", "d"], scores: [6], extras: null });
          await repo.insert({ tags: ["x", "y"], scores: [7, 8], extras: null });
        });

        test("matches entities containing all specified elements", async () => {
          const repo = getHandle().repository(TckArrayHolder);
          const results = await repo.find({ tags: { $all: ["a", "b"] } } as any, {
            order: { tags: "ASC" },
          });

          expect(results).toHaveLength(2);
          const tagSets = results.map((r) => r.tags).sort();
          expect(tagSets).toMatchSnapshot();
        });

        test("matches with single element", async () => {
          const repo = getHandle().repository(TckArrayHolder);
          const results = await repo.find({ tags: { $all: ["d"] } } as any);

          expect(results).toHaveLength(1);
          expect(results[0].tags).toMatchSnapshot();
        });

        test("returns empty when no entity contains all required elements", async () => {
          const repo = getHandle().repository(TckArrayHolder);
          const results = await (repo.find as any)({ tags: { $all: ["z", "q"] } });
          expect(results).toHaveLength(0);
        });
      });

      describe("$overlap — array contains any of the given elements", () => {
        beforeEach(async () => {
          const repo = getHandle().repository(TckArrayHolder);
          await repo.insert({ tags: ["a", "b"], scores: [1], extras: null });
          await repo.insert({ tags: ["c", "d"], scores: [2], extras: null });
          await repo.insert({ tags: ["x", "y"], scores: [3], extras: null });
        });

        test("matches entities with any overlapping element", async () => {
          const repo = getHandle().repository(TckArrayHolder);
          const results = await repo.find({ tags: { $overlap: ["a", "x"] } } as any, {
            order: { tags: "ASC" },
          });

          expect(results).toHaveLength(2);
          const tagSets = results.map((r) => r.tags).sort();
          expect(tagSets).toMatchSnapshot();
        });

        test("returns empty when no entity contains any of the elements", async () => {
          const repo = getHandle().repository(TckArrayHolder);
          const results = await (repo.find as any)({
            tags: { $overlap: ["nonexistent"] },
          });
          expect(results).toHaveLength(0);
        });
      });

      describe("$contained — all array elements are in the given set", () => {
        beforeEach(async () => {
          const repo = getHandle().repository(TckArrayHolder);
          await repo.insert({ tags: ["a"], scores: [1], extras: null });
          await repo.insert({ tags: ["a", "b"], scores: [2], extras: null });
          await repo.insert({ tags: ["a", "b", "c"], scores: [3], extras: null });
        });

        test("matches only entities whose elements are a subset of the given set", async () => {
          const repo = getHandle().repository(TckArrayHolder);
          const results = await repo.find({ tags: { $contained: ["a", "b"] } } as any, {
            order: { tags: "ASC" },
          });

          expect(results).toHaveLength(2);
          const tagSets = results.map((r) => r.tags).sort();
          expect(tagSets).toMatchSnapshot();
        });
      });

      describe("$length — array length equals N", () => {
        beforeEach(async () => {
          const repo = getHandle().repository(TckArrayHolder);
          await repo.insert({ tags: ["a", "b"], scores: [1, 2, 3], extras: null });
          await repo.insert({ tags: ["c"], scores: [4], extras: ["x", "y"] });
          await repo.insert({ tags: ["d", "e"], scores: [5, 6], extras: null });
        });

        test("matches entities where array has specified length", async () => {
          const repo = getHandle().repository(TckArrayHolder);
          const results = await repo.find({ tags: { $length: 2 } } as any, {
            order: { tags: "ASC" },
          });

          expect(results).toHaveLength(2);
          const tagSets = results.map((r) => r.tags).sort();
          expect(tagSets).toMatchSnapshot();
        });

        test("$length: 0 matches empty default array", async () => {
          await getHandle().clear();
          const repo = getHandle().repository(TckArrayHolder);
          await repo.insert({ tags: ["a"], scores: [1], extras: null });
          await repo.insert({ tags: ["b"], scores: [2], extras: null });

          // labels defaults to [] via @Default(() => [])
          const results = await repo.find({ labels: { $length: 0 } } as any);

          // Both entities should have labels = [] (default)
          expect(results).toHaveLength(2);
        });

        test("$length: 0 does not match null arrays", async () => {
          await getHandle().clear();
          const repo = getHandle().repository(TckArrayHolder);
          await repo.insert({ tags: ["a"], scores: [1], extras: null });
          await repo.insert({ tags: ["b"], scores: [2], extras: ["x"] });

          // extras is null for first entity — null is NOT the same as empty
          const results = await repo.find({ extras: { $length: 0 } } as any);

          expect(results).toHaveLength(0);
        });
      });

      describe("$length on numeric array (scores)", () => {
        beforeEach(async () => {
          const repo = getHandle().repository(TckArrayHolder);
          await repo.insert({ tags: ["a"], scores: [10, 20, 30], extras: null });
          await repo.insert({ tags: ["b"], scores: [40], extras: null });
          await repo.insert({ tags: ["c"], scores: [50, 60, 70], extras: null });
        });

        test("matches entities where scores has specified length", async () => {
          const repo = getHandle().repository(TckArrayHolder);
          const results = await repo.find({ scores: { $length: 3 } } as any, {
            order: { tags: "ASC" },
          });

          expect(results).toHaveLength(2);
          const scoreSets = results.map((r) => r.scores).sort();
          expect(scoreSets).toMatchSnapshot();
        });
      });

      describe("logical composition with array operators", () => {
        beforeEach(async () => {
          const repo = getHandle().repository(TckArrayHolder);
          await repo.insert({ tags: ["a", "b"], scores: [1], extras: null });
          await repo.insert({ tags: ["c"], scores: [2], extras: null });
          await repo.insert({ tags: [], scores: [3], extras: null });
        });

        test("$or with $all and $length", async () => {
          const repo = getHandle().repository(TckArrayHolder);
          const results = await repo.find(
            {
              $or: [{ tags: { $all: ["a", "b"] } }, { tags: { $length: 0 } }],
            } as any,
            { order: { tags: "ASC" } },
          );

          expect(results).toHaveLength(2);
          const tagSets = results.map((r) => r.tags).sort();
          expect(tagSets).toMatchSnapshot();
        });
      });
    });

    // ─── JSON containment ($has) on TckJsonHolder ──────────────────────

    describe("JSON containment ($has)", () => {
      const { TckJsonHolder } = entities;

      beforeEach(async () => {
        await getHandle().clear();
      });

      describe("$has on metadata (Record<string, unknown>)", () => {
        beforeEach(async () => {
          const repo = getHandle().repository(TckJsonHolder);
          await repo.insert({
            metadata: { theme: "dark", version: 2 },
            settings: { theme: "dark", count: 5 },
            payload: { items: ["a"], count: 1 },
          });
          await repo.insert({
            metadata: { theme: "light", version: 1 },
            settings: { theme: "light", count: 3 },
            payload: { items: ["b", "c"], count: 2 },
          });
          await repo.insert({
            metadata: { theme: "dark", version: 3, extra: true },
            settings: { theme: "dark", count: 10 },
            payload: { items: ["d"], count: 1 },
          });
        });

        test("matches entities with matching key-value pair", async () => {
          const repo = getHandle().repository(TckJsonHolder);
          const results = await repo.find({
            metadata: { $has: { theme: "dark" } },
          } as any);

          expect(results).toHaveLength(2);
          const metadatas = results
            .map((r) => r.metadata)
            .sort((a, b) => (a.version as number) - (b.version as number));
          expect(metadatas).toMatchSnapshot();
        });
      });

      describe("$has on settings (object field)", () => {
        beforeEach(async () => {
          const repo = getHandle().repository(TckJsonHolder);
          await repo.insert({
            metadata: { a: 1 },
            settings: { theme: "light", count: 5 },
            payload: { items: [], count: 0 },
          });
          await repo.insert({
            metadata: { b: 2 },
            settings: { theme: "dark", count: 3 },
            payload: { items: [], count: 0 },
          });
        });

        test("matches entities by settings key-value", async () => {
          const repo = getHandle().repository(TckJsonHolder);
          const results = await repo.find({
            settings: { $has: { theme: "light" } },
          } as any);

          expect(results).toHaveLength(1);
          expect(results[0].settings).toMatchSnapshot();
        });
      });

      describe("$has on payload (object with nested array)", () => {
        beforeEach(async () => {
          const repo = getHandle().repository(TckJsonHolder);
          await repo.insert({
            metadata: { x: 1 },
            settings: { theme: "dark", count: 1 },
            payload: { items: ["x", "y"], count: 2 },
          });
          await repo.insert({
            metadata: { x: 2 },
            settings: { theme: "light", count: 2 },
            payload: { items: ["z"], count: 1 },
          });
        });

        test("matches entities by payload scalar key-value", async () => {
          const repo = getHandle().repository(TckJsonHolder);
          const results = await repo.find({ payload: { $has: { count: 2 } } } as any);

          expect(results).toHaveLength(1);
          expect(results[0].payload).toMatchSnapshot();
        });

        test("matches entities by payload nested array exact match", async () => {
          const repo = getHandle().repository(TckJsonHolder);
          const results = await (repo.find as any)({
            payload: { $has: { items: ["x", "y"] } },
          });
          expect(results).toHaveLength(1);
          expect(results[0].payload).toMatchSnapshot();
        });
      });

      describe("combined $has with another field predicate", () => {
        beforeEach(async () => {
          const repo = getHandle().repository(TckJsonHolder);
          await repo.insert({
            metadata: { theme: "dark" },
            settings: { theme: "light", count: 1 },
            payload: { items: [], count: 0 },
          });
          await repo.insert({
            metadata: { theme: "light" },
            settings: { theme: "light", count: 2 },
            payload: { items: [], count: 0 },
          });
          await repo.insert({
            metadata: { theme: "dark" },
            settings: { theme: "dark", count: 3 },
            payload: { items: [], count: 0 },
          });
        });

        test("intersection of $has on two fields", async () => {
          const repo = getHandle().repository(TckJsonHolder);
          const results = await repo.find({
            metadata: { $has: { theme: "dark" } },
            settings: { $has: { theme: "light" } },
          } as any);

          expect(results).toHaveLength(1);
          expect(results[0].metadata).toMatchSnapshot();
          expect(results[0].settings).toMatchSnapshot();
        });
      });
    });

    // ─── Embedded criteria on TckWithAddress ───────────────────────────

    describe("Embedded criteria", () => {
      const { TckWithAddress } = entities;

      beforeEach(async () => {
        await getHandle().clear();
      });

      describe("basic embedded criteria", () => {
        beforeEach(async () => {
          const repo = getHandle().repository(TckWithAddress);
          await repo.insert({
            name: "Alice",
            address: { street: "1 Main St", city: "London", country: "UK" },
          });
          await repo.insert({
            name: "Bob",
            address: { street: "2 Oak Ave", city: "Paris", country: "FR" },
          });
        });

        test("filters by embedded field value", async () => {
          const repo = getHandle().repository(TckWithAddress);
          const results = await repo.find({ address: { city: "London" } } as any);

          expect(results).toHaveLength(1);
          expect(results[0].name).toBe("Alice");
          expect(results[0].address).toMatchSnapshot();
        });
      });

      describe("embedded with country filter", () => {
        beforeEach(async () => {
          const repo = getHandle().repository(TckWithAddress);
          await repo.insert({
            name: "Alice",
            address: { street: "1 Main St", city: "London", country: "UK" },
          });
          await repo.insert({
            name: "Charlie",
            address: { street: "3 High St", city: "Manchester", country: "UK" },
          });
          await repo.insert({
            name: "Bob",
            address: { street: "2 Oak Ave", city: "Paris", country: "FR" },
          });
        });

        test("filters by embedded country", async () => {
          const repo = getHandle().repository(TckWithAddress);
          const results = await repo.find({ address: { country: "UK" } } as any, {
            order: { name: "ASC" },
          });

          expect(results).toHaveLength(2);
          expect(results.map((r) => r.name)).toMatchSnapshot();
        });
      });

      describe("logical composition with embedded", () => {
        beforeEach(async () => {
          const repo = getHandle().repository(TckWithAddress);
          await repo.insert({
            name: "Alice",
            address: { street: "1 Main St", city: "London", country: "UK" },
          });
          await repo.insert({
            name: "Bob",
            address: { street: "2 Oak Ave", city: "Paris", country: "FR" },
          });
          await repo.insert({
            name: "Charlie",
            address: { street: "3 High St", city: "Berlin", country: "DE" },
          });
        });

        test("$or with embedded criteria returns union", async () => {
          const repo = getHandle().repository(TckWithAddress);
          const results = await repo.find(
            {
              $or: [{ address: { city: "London" } }, { address: { city: "Paris" } }],
            } as any,
            { order: { name: "ASC" } },
          );

          expect(results).toHaveLength(2);
          expect(results.map((r) => r.name)).toMatchSnapshot();
        });
      });

      describe("null embedded", () => {
        beforeEach(async () => {
          const repo = getHandle().repository(TckWithAddress);
          await repo.insert({
            name: "Alice",
            address: { street: "1 Main St", city: "London", country: "UK" },
          });
          await repo.insert({
            name: "NoAddress",
            address: null,
          });
        });

        test("embedded criteria does not match null embedded", async () => {
          const repo = getHandle().repository(TckWithAddress);
          const results = await repo.find({ address: { city: "London" } } as any);

          expect(results).toHaveLength(1);
          expect(results[0].name).toBe("Alice");
        });

        test("null embedded entity is excluded from non-null embedded queries", async () => {
          const repo = getHandle().repository(TckWithAddress);
          const results = await repo.find({ address: { country: "UK" } } as any);

          expect(results).toHaveLength(1);
          expect(results[0].name).toBe("Alice");
        });
      });
    });
  });
};
