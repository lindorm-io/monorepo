import { describe, test, expect, beforeEach } from "vitest";
// TCK: Complex Predicates Suite
// Tests $all, $overlap, $contained, $length, $has, and embedded criteria.

import type { TckCapabilities, TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const complexPredicatesSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
  caps: TckCapabilities,
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

    // ─── JSONB-backed array operators on TckJsonbArray ─────────────────
    // tags is `@Field("array")` with NO arrayType → stored as JSON/JSONB,
    // NOT a native PG array. Exercises the jsonb branch of the dialect
    // ($overlap/$all/$contained/$length). Asserts VALUES, not SQL.

    describe("JSONB-backed array operators", () => {
      const { TckJsonbArray } = entities;

      beforeEach(async () => {
        await getHandle().clear();
        const repo = getHandle().repository(TckJsonbArray);
        await repo.insert({ name: "ab", tags: ["a", "b"] });
        await repo.insert({ name: "abc", tags: ["a", "b", "c"] });
        await repo.insert({ name: "cd", tags: ["c", "d"] });
        await repo.insert({ name: "xy", tags: ["x", "y", "z"] });
      });

      test("$overlap matches rows sharing any element", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ tags: { $overlap: ["a", "x"] } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["ab", "abc", "xy"]);
      });

      test("$overlap returns empty when nothing matches", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await (repo.find as any)({ tags: { $overlap: ["nope"] } });
        expect(results).toHaveLength(0);
      });

      test("$all matches rows containing all elements", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ tags: { $all: ["a", "b"] } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["ab", "abc"]);
      });

      test("$contained matches rows whose elements are a subset", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find(
          { tags: { $contained: ["a", "b", "c"] } } as any,
          {
            order: { name: "ASC" },
          },
        );
        expect(results.map((r) => r.name)).toEqual(["ab", "abc"]);
      });

      test("$length matches rows with the given element count", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ tags: { $length: 2 } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["ab", "cd"]);
      });

      test("$length: 3 matches the three-element rows", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ tags: { $length: 3 } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["abc", "xy"]);
      });

      test("update path persists a new jsonb array value", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const row = await repo.findOneOrFail({ name: "cd" } as any);

        row.tags = ["e", "f", "g"];
        await repo.update(row);

        const reloaded = await repo.findOneOrFail({ name: "cd" } as any);
        expect(reloaded.tags).toEqual(["e", "f", "g"]);

        // The new value is queryable through the jsonb operators
        const byLength = await repo.find({ tags: { $length: 3 } } as any, {
          order: { name: "ASC" },
        });
        expect(byLength.map((r) => r.name)).toEqual(["abc", "cd", "xy"]);

        const byOverlap = await repo.find({ tags: { $overlap: ["f"] } } as any);
        expect(byOverlap.map((r) => r.name)).toEqual(["cd"]);
      });
    });

    // ─── Criteria-level $not on TckJsonbArray ──────────────────────────
    // `$not` as a criteria KEY negates a whole sub-predicate. It is a distinct
    // operator from the field-level `{ field: { $not: … } }` form.
    //
    // The criteria language is `@lindorm/match`'s, so `$not` means the matcher's
    // TWO-valued negation — `!matches(row, sub)` — on EVERY driver. The in-memory
    // drivers are the matcher; MongoDB (which has no top-level `$not`) uses `$nor`,
    // which includes a null-or-missing field; the SQL drivers must emit
    // `(…) IS NOT TRUE` rather than `NOT (…)`, because SQL's three-valued `NOT`
    // turns a NULL column's comparison into UNKNOWN and silently drops the row.
    //
    // `label` is nullable and two rows hold NULL, so a driver that borrows SQL's
    // three-valued negation fails the `label` cases. The `name` cases are over a
    // NOT NULL column and must be unaffected by that distinction.

    describe("Criteria-level $not", () => {
      const { TckJsonbArray } = entities;

      beforeEach(async () => {
        await getHandle().clear();
        const repo = getHandle().repository(TckJsonbArray);
        await repo.insert({ name: "ab", label: "keep", tags: ["a", "b"] });
        await repo.insert({ name: "abc", label: "drop", tags: ["a", "b", "c"] });
        await repo.insert({ name: "cd", label: null, tags: ["c", "d"] });
        await repo.insert({ name: "xy", label: null, tags: ["x", "y", "z"] });
      });

      test("negates a single-field sub-predicate", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ $not: { name: "cd" } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["ab", "abc", "xy"]);
      });

      test("negates a nested $or", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find(
          { $not: { $or: [{ name: "ab" }, { name: "cd" }] } } as any,
          { order: { name: "ASC" } },
        );
        expect(results.map((r) => r.name)).toEqual(["abc", "xy"]);
      });

      test("negates a field operator", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find(
          { $not: { name: { $in: ["ab", "xy"] } } } as any,
          { order: { name: "ASC" } },
        );
        expect(results.map((r) => r.name)).toEqual(["abc", "cd"]);
      });

      test("intersects with a sibling field criterion", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find(
          { tags: { $length: 2 }, $not: { name: "cd" } } as any,
          { order: { name: "ASC" } },
        );
        expect(results.map((r) => r.name)).toEqual(["ab"]);
      });

      test("negating a predicate nothing matches returns every row", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ $not: { name: "nope" } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["ab", "abc", "cd", "xy"]);
      });

      // ── NULL rows: the matcher keeps them, SQL's `NOT (…)` would drop them ──

      test("keeps rows whose negated column is NULL", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ $not: { label: "drop" } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["ab", "cd", "xy"]);
      });

      test("keeps NULL rows when negating a field operator", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find(
          { $not: { label: { $in: ["drop", "keep"] } } } as any,
          { order: { name: "ASC" } },
        );
        expect(results.map((r) => r.name)).toEqual(["cd", "xy"]);
      });

      test("keeps NULL rows when negating a nested $or", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find(
          { $not: { $or: [{ label: "drop" }, { name: "ab" }] } } as any,
          { order: { name: "ASC" } },
        );
        expect(results.map((r) => r.name)).toEqual(["cd", "xy"]);
      });

      test("keeps NULL rows for a $not nested inside $and", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find(
          {
            $and: [{ tags: { $length: 2 } }, { $not: { label: "drop" } }],
          } as any,
          { order: { name: "ASC" } },
        );
        expect(results.map((r) => r.name)).toEqual(["ab", "cd"]);
      });

      test("keeps NULL rows for a $not nested inside $or", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find(
          {
            $or: [{ name: "abc" }, { $not: { label: "keep" } }],
          } as any,
          { order: { name: "ASC" } },
        );
        expect(results.map((r) => r.name)).toEqual(["abc", "cd", "xy"]);
      });

      test("an explicit NULL sub-predicate still negates to the non-NULL rows", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ $not: { label: null } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["ab", "abc"]);
      });

      // ── Empty sub-predicate ──
      // An empty sub-predicate matches EVERY row, so its negation matches none.
      // The SQL drivers compile a sub-predicate to a clause string, and an empty
      // one yields no clause at all — which without an explicit constant would
      // drop the `$not` and return everything, the exact inverse.

      test("an empty $not matches nothing", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ $not: {} } as any, {
          order: { name: "ASC" },
        });
        expect(results).toEqual([]);
      });

      test("a $not over a no-op sub-clause matches nothing", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ $not: { name: { $nin: [] } } } as any, {
          order: { name: "ASC" },
        });
        expect(results).toEqual([]);
      });
    });

    // ─── $neq / $nin over a NULLABLE column ────────────────────────────
    // SQL's `<>` and `NOT IN` are THREE-valued: against a NULL column they
    // evaluate to UNKNOWN and the row is DROPPED. The condition language is
    // two-valued — a row whose column is null is not equal to "drop", so
    // negating that equality KEEPS it — and the driver is meant to be an
    // implementation detail. Verified at HEAD on postgres 17.10, mysql 9.7.1 and
    // sqlite 3.53.0: `label <> 'drop'` returned one row of four where the
    // matcher returns three.
    //
    // `label` is nullable and two rows hold NULL, which is what makes these
    // cases able to fail at all — every `$neq` case over a NOT NULL column
    // passes under either reading and proves nothing.
    //
    // Every expectation comes from running `Matcher.filter` from `@lindorm/match`
    // over these exact four rows.

    describe("$neq / $nin over a nullable column", () => {
      const { TckJsonbArray } = entities;

      beforeEach(async () => {
        await getHandle().clear();
        const repo = getHandle().repository(TckJsonbArray);
        await repo.insert({ name: "ab", label: "keep", tags: ["a", "b"] });
        await repo.insert({ name: "abc", label: "drop", tags: ["a", "b", "c"] });
        await repo.insert({ name: "cd", label: null, tags: ["c", "d"] });
        await repo.insert({ name: "xy", label: null, tags: ["x", "y", "z"] });
      });

      test("$neq keeps the rows whose column is NULL", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ label: { $neq: "drop" } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["ab", "cd", "xy"]);
      });

      test("$nin keeps the rows whose column is NULL", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ label: { $nin: ["drop"] } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["ab", "cd", "xy"]);
      });

      test("$nin over several values keeps the NULL rows", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ label: { $nin: ["drop", "keep"] } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["cd", "xy"]);
      });

      // `$eq: null` and `$neq: null` ask about the null VALUE and are a separate
      // question — both already agreed with the matcher and must keep doing so.
      test("$neq: null still returns only the non-NULL rows", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ label: { $neq: null } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["ab", "abc"]);
      });

      test("$eq: null still returns only the NULL rows", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ label: { $eq: null } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["cd", "xy"]);
      });

      test("$neq over a NOT NULL column is unchanged", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ name: { $neq: "ab" } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["abc", "cd", "xy"]);
      });

      test("$nin over a NOT NULL column is unchanged", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ name: { $nin: ["ab", "abc"] } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["cd", "xy"]);
      });

      test("$neq intersects with a sibling criterion", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find(
          { label: { $neq: "drop" }, tags: { $length: 2 } } as any,
          { order: { name: "ASC" } },
        );
        expect(results.map((r) => r.name)).toEqual(["ab", "cd"]);
      });

      test("$nin and $neq in one operator bag are conjoined", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find(
          { label: { $nin: ["drop"], $neq: "keep" } } as any,
          { order: { name: "ASC" } },
        );
        expect(results.map((r) => r.name)).toEqual(["cd", "xy"]);
      });

      test("$nin composes inside a criteria-level $or", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find(
          { $or: [{ name: "abc" }, { label: { $nin: ["keep"] } }] } as any,
          { order: { name: "ASC" } },
        );
        expect(results.map((r) => r.name)).toEqual(["abc", "cd", "xy"]);
      });

      test("$neq composes inside a criteria-level $and", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find(
          { $and: [{ label: { $neq: "drop" } }, { tags: { $length: 2 } }] } as any,
          { order: { name: "ASC" } },
        );
        expect(results.map((r) => r.name)).toEqual(["ab", "cd"]);
      });

      // Negating a two-valued `$neq` must give back exactly its complement,
      // NULL rows included — a three-valued `$neq` loses them from both sides.
      test("a criteria-level $not over $neq returns the complement", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ $not: { label: { $neq: "drop" } } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["abc"]);
      });

      test("a field-level $not over $neq returns the complement", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ label: { $not: { $neq: "drop" } } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["abc"]);
      });

      // The same double negation one operator over. `$nin` is already a
      // negation, so negating it must give back the inclusion it excludes —
      // which only holds while `$nin` itself is two-valued.
      test("a criteria-level $not over $nin returns the complement", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ $not: { label: { $nin: ["drop"] } } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["abc"]);
      });

      test("a field-level $not over $nin returns the complement", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ label: { $not: { $nin: ["drop"] } } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["abc"]);
      });

      // A null MEMBER of the list is a value like any other: `$in: [null]`
      // selects the NULL rows and `$nin: [null]` excludes them. `col IN (NULL)`
      // is UNKNOWN for every row, so both used to return nothing at all.
      test("$in holding null selects the NULL rows", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ label: { $in: [null] } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["cd", "xy"]);
      });

      test("$in holding null alongside a value takes the union", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ label: { $in: ["drop", null] } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["abc", "cd", "xy"]);
      });

      test("$nin holding null excludes the NULL rows", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ label: { $nin: [null] } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["ab", "abc"]);
      });

      test("$nin holding null alongside a value excludes both", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ label: { $nin: ["drop", null] } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["ab"]);
      });

      // The three-state compiled result, unchanged: an empty exclusion list
      // excludes nothing and an empty inclusion list can never hold.
      test("an empty $nin still excludes nothing", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ label: { $nin: [] } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["ab", "abc", "cd", "xy"]);
      });

      test("an empty $in still matches nothing", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ label: { $in: [] } } as any, {
          order: { name: "ASC" },
        });
        expect(results).toEqual([]);
      });
    });

    // ─── Field-level $not on TckJsonbArray ─────────────────────────────
    // `{ field: { $not: … } }` negates ONE column's condition — a distinct
    // operator from the criteria-level `$not` above, and the one the SQL
    // compilers had no branch for at all: the clause vanished and the query
    // returned EVERY row, silently over-matching a filter written to exclude.
    //
    // Its meaning is the matcher's too — `!matchConditionOperator(value, inner)`
    // — so it is likewise two-valued: a NULL column is simply "not equal", and
    // negating an operator over it keeps the row. Every expectation below was
    // taken from running `@lindorm/match` over these same four rows, not from
    // what any driver happened to return.

    describe("Field-level $not", () => {
      const { TckJsonbArray } = entities;

      beforeEach(async () => {
        await getHandle().clear();
        const repo = getHandle().repository(TckJsonbArray);
        await repo.insert({ name: "ab", label: "keep", tags: ["a", "b"] });
        await repo.insert({ name: "abc", label: "drop", tags: ["a", "b", "c"] });
        await repo.insert({ name: "cd", label: null, tags: ["c", "d"] });
        await repo.insert({ name: "xy", label: null, tags: ["x", "y", "z"] });
      });

      test("negates an operator on a NOT NULL column", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ name: { $not: { $eq: "ab" } } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["abc", "cd", "xy"]);
      });

      test("keeps rows whose negated column is NULL", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ label: { $not: { $eq: "drop" } } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["ab", "cd", "xy"]);
      });

      test("keeps NULL rows when negating $in", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find(
          { label: { $not: { $in: ["drop", "keep"] } } } as any,
          { order: { name: "ASC" } },
        );
        expect(results.map((r) => r.name)).toEqual(["cd", "xy"]);
      });

      test("negating $eq: null returns the non-NULL rows", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ label: { $not: { $eq: null } } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["ab", "abc"]);
      });

      // A NON-OBJECT `$not` payload is no longer part of the language. It was
      // never declared in the type, and the matcher read it as
      // `value !== inner` — a REFERENCE comparison, so a Date, Buffer or array
      // payload was always "not equal" and the criterion constrained nothing.
      // `{ label: { $not: "drop" } }` is now a malformed condition; write
      // `{ label: { $not: { $eq: "drop" } } }`.

      test("intersects two field-level negations in one criteria object", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find(
          {
            label: { $not: { $eq: "keep" } },
            tags: { $not: { $length: 3 } },
          } as any,
          { order: { name: "ASC" } },
        );
        expect(results.map((r) => r.name)).toEqual(["cd"]);
      });

      test("negates an array operator", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ tags: { $not: { $all: ["a"] } } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["cd", "xy"]);
      });

      test("negates $length", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ tags: { $not: { $length: 2 } } } as any, {
          order: { name: "ASC" },
        });
        expect(results.map((r) => r.name)).toEqual(["abc", "xy"]);
      });

      test("composes with a criteria-level $and", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find(
          {
            $and: [{ tags: { $length: 2 } }, { label: { $not: { $eq: "keep" } } }],
          } as any,
          { order: { name: "ASC" } },
        );
        expect(results.map((r) => r.name)).toEqual(["cd"]);
      });

      test("composes with a criteria-level $or", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find(
          {
            $or: [{ name: "abc" }, { label: { $not: { $eq: "keep" } } }],
          } as any,
          { order: { name: "ASC" } },
        );
        expect(results.map((r) => r.name)).toEqual(["abc", "cd", "xy"]);
      });

      // A criteria-level `$not` wrapping a field-level one — the two negations
      // must cancel, including on the NULL rows.
      test("cancels against an enclosing criteria-level $not", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find(
          { $not: { label: { $not: { $eq: "drop" } } } } as any,
          { order: { name: "ASC" } },
        );
        expect(results.map((r) => r.name)).toEqual(["abc"]);
      });

      // `{ label: { $not: {} } }` is no longer part of the language either. A
      // criteria-level `{}` legitimately means "no constraints", but a NAMED
      // field's empty bag constrains nothing while claiming to constrain
      // something — so it is malformed rather than a negated tautology.

      test("a field-level $not over a no-op sub-clause matches nothing", async () => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await repo.find({ label: { $not: { $nin: [] } } } as any, {
          order: { name: "ASC" },
        });
        expect(results).toEqual([]);
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

    // ─── Structured operators over a column holding a list or a document ──
    //
    // The operators that read INTO a column: `$length`, `$all`, `$overlap`,
    // `$contained`, `$in` / `$nin` against a list, `$has`, and the bare array.
    // Each dialect used to assume what the column held, and they assumed
    // different things — so the three disagreed with each other as well as with
    // the condition language.
    //
    // A NULL column is where every one of those disagreements shows, and no
    // suite could see any of it: `TckJsonHolder` had no nullable document at all
    // and the one nullable array was queried by a single `$length: 0`. Both
    // gaps are closed by the `extras` columns these blocks query.
    //
    // Every expectation comes from running `Matcher.filter` from `@lindorm/match`
    // over these exact rows. None of it was read off a driver.

    // ─── `$exists` means NOT NULL, on every driver ────────────────────────
    //
    // UNGATED on purpose. This is basic column semantics, not a structured
    // operator, and it sat inside the `structuredOperators` block — so the one
    // driver that declares that capability false was never asked the question,
    // and answered it wrong: with no `$exists` branch in its filter compiler the
    // operator reached MongoDB verbatim, where it means KEY PRESENCE. Documents
    // are written with an explicit null for every declared field, so the key is
    // always there: `$exists: true` matched EVERY document and `$exists: false`
    // matched none. The first of those is destructive, which is why the row
    // count below is asserted on a delete as well as a read.
    //
    // Every expectation comes from running `Matcher.filter` from
    // `@lindorm/match` over these exact rows.
    describe("$exists", () => {
      const { TckJsonbArray } = entities;

      beforeEach(async () => {
        await getHandle().clear();
        const repo = getHandle().repository(TckJsonbArray);
        await repo.insert({ name: "ab", label: "keep", tags: ["a"], extras: ["x"] });
        await repo.insert({ name: "abc", label: "drop", tags: ["a", "b"], extras: [] });
        await repo.insert({ name: "cd", label: null, tags: ["c"], extras: null });
        await repo.insert({ name: "xy", label: null, tags: ["x"], extras: null });
      });

      const names = async (criteria: unknown) => {
        const repo = getHandle().repository(TckJsonbArray);
        const results = await (repo.find as any)(criteria, { order: { name: "ASC" } });
        return results.map((r: { name: string }) => r.name);
      };

      test("$exists: true selects the rows whose column is not null", async () => {
        expect(await names({ label: { $exists: true } })).toEqual(["ab", "abc"]);
      });

      test("$exists: false selects the rows whose column IS null", async () => {
        expect(await names({ label: { $exists: false } })).toEqual(["cd", "xy"]);
      });

      // An EMPTY list is a value, not an absence — the distinction a key-presence
      // reading cannot make either.
      test("$exists over an array column counts the empty list as present", async () => {
        expect(await names({ extras: { $exists: true } })).toEqual(["ab", "abc"]);
        expect(await names({ extras: { $exists: false } })).toEqual(["cd", "xy"]);
      });

      test("$exists composes with a sibling criterion", async () => {
        expect(await names({ label: { $exists: true }, tags: { $length: 1 } })).toEqual([
          "ab",
        ]);
      });

      // The destructive face. `$exists: true` is correctly rated as restricting
      // by the destructive-criteria guard, so a compiler that reads it as key
      // presence empties the table with the guard's blessing.
      test("delete removes only the rows whose column is not null", async () => {
        const repo = getHandle().repository(TckJsonbArray);

        await repo.delete({ label: { $exists: true } } as any);

        const rows = await repo.find(undefined, { order: { name: "ASC" } });
        expect(rows.map((r) => r.name)).toEqual(["cd", "xy"]);
      });

      test("delete removes only the rows whose column IS null", async () => {
        const repo = getHandle().repository(TckJsonbArray);

        await repo.delete({ label: { $exists: false } } as any);

        const rows = await repo.find(undefined, { order: { name: "ASC" } });
        expect(rows.map((r) => r.name)).toEqual(["ab", "abc"]);
      });
    });

    if (caps.structuredOperators) {
      describe("Structured operators over a NULLABLE jsonb array", () => {
        const { TckJsonbArray } = entities;

        beforeEach(async () => {
          await getHandle().clear();
          const repo = getHandle().repository(TckJsonbArray);
          await repo.insert({
            name: "ab",
            label: "keep",
            tags: ["a", "b"],
            extras: ["x"],
          });
          await repo.insert({
            name: "abc",
            label: "drop",
            tags: ["a", "b", "c"],
            extras: [],
          });
          await repo.insert({ name: "cd", label: null, tags: ["c", "d"], extras: null });
          await repo.insert({
            name: "xy",
            label: null,
            tags: ["x", "y", "z"],
            extras: null,
          });
        });

        const names = async (criteria: unknown) => {
          const repo = getHandle().repository(TckJsonbArray);
          const results = await (repo.find as any)(criteria, { order: { name: "ASC" } });
          return results.map((r: { name: string }) => r.name);
        };

        // `$all` requires an ARRAY value, so an empty required-element list is
        // satisfied by any list and by no NULL. mysql and sqlite short-circuited
        // to `1=1` and handed back the NULL rows; postgres was already right.
        test("$all with an empty list excludes the NULL rows", async () => {
          expect(await names({ extras: { $all: [] } })).toEqual(["ab", "abc"]);
        });

        test("$all with a real element", async () => {
          expect(await names({ extras: { $all: ["x"] } })).toEqual(["ab"]);
        });

        // Contained by the empty set means the row's own list is EMPTY. mysql
        // and sqlite emitted `col IS NULL OR len = 0` and let the NULL rows in.
        test("$contained by an empty set matches only the empty list", async () => {
          expect(await names({ extras: { $contained: [] } })).toEqual(["abc"]);
        });

        // sqlite's `NOT EXISTS` over `json_each(NULL)` was VACUOUSLY TRUE, so
        // every NULL row came back — on that dialect alone.
        test("$contained over a NULL column does not match", async () => {
          expect(await names({ extras: { $contained: ["x"] } })).toEqual(["ab", "abc"]);
        });

        test("$overlap with an empty list matches nothing", async () => {
          expect(await names({ extras: { $overlap: [] } })).toEqual([]);
        });

        test("$overlap with a real element", async () => {
          expect(await names({ extras: { $overlap: ["x"] } })).toEqual(["ab"]);
        });

        // `$in` against a LIST is overlap, not a comparison against the whole
        // array: a hard error on postgres, a silent empty result on mysql and
        // sqlite.
        test("$in against an array column takes the overlap", async () => {
          expect(await names({ extras: { $in: ["x"] } })).toEqual(["ab"]);
        });

        test("$nin against an array column keeps the NULL rows", async () => {
          expect(await names({ extras: { $nin: ["x"] } })).toEqual(["abc", "cd", "xy"]);
        });

        test("$has takes a single element", async () => {
          expect(await names({ extras: { $has: "x" } })).toEqual(["ab"]);
        });

        // A bare ARRAY is CONTAINMENT. Bound as a plain `=` parameter it was an
        // error on postgres and sqlite and a silent non-match on mysql.
        test("a bare array is containment", async () => {
          expect(await names({ extras: ["x"] })).toEqual(["ab"]);
        });

        test("a bare empty array matches every list", async () => {
          expect(await names({ extras: [] })).toEqual(["ab", "abc"]);
        });

        test("$length counts elements and does not count a NULL", async () => {
          expect(await names({ extras: { $length: 0 } })).toEqual(["abc"]);
          expect(await names({ extras: { $length: 1 } })).toEqual(["ab"]);
        });

        test("negating an empty $all returns exactly the NULL rows", async () => {
          expect(await names({ extras: { $not: { $all: [] } } })).toEqual(["cd", "xy"]);
        });

        // ── the NOT NULL list, so the element-containment forms are proved
        // ── independently of the null question

        test("$has and the bare array are two spellings of one thing", async () => {
          expect(await names({ tags: { $has: "a" } })).toEqual(["ab", "abc"]);
          expect(await names({ tags: ["a"] })).toEqual(["ab", "abc"]);
        });

        test("a bare array requires EVERY listed element", async () => {
          expect(await names({ tags: ["a", "c"] })).toEqual(["abc"]);
        });

        test("$has accepts a list of elements", async () => {
          expect(await names({ tags: { $has: ["a", "b"] } })).toEqual(["ab", "abc"]);
        });

        test("$in over a NOT NULL list takes the overlap", async () => {
          expect(await names({ tags: { $in: ["a", "x"] } })).toEqual(["ab", "abc", "xy"]);
        });

        test("$nin over a NOT NULL list is its complement", async () => {
          expect(await names({ tags: { $nin: ["a"] } })).toEqual(["cd", "xy"]);
        });

        // The three-state compiled result carries across the array branch too.
        test("an empty $in still matches nothing and an empty $nin still excludes nothing", async () => {
          expect(await names({ tags: { $in: [] } })).toEqual([]);
          expect(await names({ tags: { $nin: [] } })).toEqual(["ab", "abc", "cd", "xy"]);
        });

        // ── $length on a STRING column: postgres and sqlite errored, mysql
        // ── errored, all three by measuring a character column as JSON.

        test("$length counts characters on a string column", async () => {
          expect(await names({ label: { $length: 4 } })).toEqual(["ab", "abc"]);
        });

        test("$length on a string column does not count the NULL rows", async () => {
          expect(await names({ label: { $length: 0 } })).toEqual([]);
        });

        test("negated string $length keeps the NULL rows", async () => {
          expect(await names({ label: { $not: { $length: 4 } } })).toEqual(["cd", "xy"]);
        });

        // ── a column with no length at all is REFUSED, rather than erroring in
        // ── the database or silently returning nothing

        // ⚠ NOT asserted here: `$has` on a SCALAR column. The SQL drivers refuse
        // it — one spelling per meaning, and the same treatment `$all` already
        // gets on a column it cannot apply to — while the condition language
        // reduces it to a plain equality and MATCHES. That is a known
        // driver-vs-oracle divergence, so it is stated rather than encoded as
        // shared behaviour; the SQL side is asserted in the compiler's own test.

        test.each([
          ["an integer column", { version: { $length: 1 } }],
          ["a date column", { createdAt: { $length: 1 } }],
          ["a non-number operand", { label: { $length: "4" } }],
        ])("refuses $length on %s", async (_label, criteria) => {
          const repo = getHandle().repository(TckJsonbArray);
          await expect((repo.find as any)(criteria)).rejects.toThrow();
        });
      });

      describe("Structured operators over a NULLABLE native array", () => {
        // `TckArrayHolder.extras` declares `arrayType`, which on postgres is a
        // NATIVE `text[]` rather than JSONB — a different code path in every
        // operator, and the one that hard-errors on a scalar comparison.
        const { TckArrayHolder } = entities;

        beforeEach(async () => {
          await getHandle().clear();
          const repo = getHandle().repository(TckArrayHolder);
          await repo.insert({ tags: ["a"], scores: [1], extras: ["x", "y"] });
          await repo.insert({ tags: ["b"], scores: [2], extras: [] });
          await repo.insert({ tags: ["c"], scores: [3], extras: null });
        });

        const tags = async (criteria: unknown) => {
          const repo = getHandle().repository(TckArrayHolder);
          const results = await (repo.find as any)(criteria, { order: { tags: "ASC" } });
          return results.map((r: { tags: Array<string> }) => r.tags[0]);
        };

        test("$all with an empty list excludes the NULL row", async () => {
          expect(await tags({ extras: { $all: [] } })).toEqual(["a", "b"]);
        });

        test("$contained by an empty set matches only the empty list", async () => {
          expect(await tags({ extras: { $contained: [] } })).toEqual(["b"]);
        });

        test("$contained over a NULL column does not match", async () => {
          expect(await tags({ extras: { $contained: ["x", "y", "z"] } })).toEqual([
            "a",
            "b",
          ]);
        });

        test("$overlap with a real element", async () => {
          expect(await tags({ extras: { $overlap: ["x"] } })).toEqual(["a"]);
        });

        test("$has takes a single element", async () => {
          expect(await tags({ extras: { $has: "x" } })).toEqual(["a"]);
        });

        test("a bare array is containment", async () => {
          expect(await tags({ extras: ["x"] })).toEqual(["a"]);
        });

        test("$in against a native array takes the overlap", async () => {
          expect(await tags({ extras: { $in: ["x", "q"] } })).toEqual(["a"]);
        });

        test("$nin against a native array keeps the NULL row", async () => {
          expect(await tags({ extras: { $nin: ["x"] } })).toEqual(["b", "c"]);
        });

        test("$length counts elements, including the empty list", async () => {
          expect(await tags({ extras: { $length: 2 } })).toEqual(["a"]);
          expect(await tags({ extras: { $length: 0 } })).toEqual(["b"]);
        });

        test("$in over a NOT NULL native array", async () => {
          expect(await tags({ tags: { $in: ["a", "c"] } })).toEqual(["a", "c"]);
        });

        test("$in over a numeric native array", async () => {
          expect(await tags({ scores: { $in: [1, 3] } })).toEqual(["a", "c"]);
        });

        test("$has over a NOT NULL native array", async () => {
          expect(await tags({ tags: { $has: "a" } })).toEqual(["a"]);
        });
      });

      describe("Structured operators over a NULLABLE document", () => {
        const { TckJsonHolder } = entities;

        beforeEach(async () => {
          await getHandle().clear();
          const repo = getHandle().repository(TckJsonHolder);
          await repo.insert({
            metadata: { theme: "dark", version: 2 },
            settings: { theme: "dark", count: 5 },
            payload: { items: ["a"], count: 1 },
            extras: { a: 1 },
          });
          await repo.insert({
            metadata: { theme: "light", version: 1 },
            settings: { theme: "light", count: 3 },
            payload: { items: ["b", "c"], count: 2 },
            extras: null,
          });
          await repo.insert({
            metadata: { theme: "dark", version: 3, extra: true },
            settings: { theme: "dark", count: 10 },
            payload: { items: ["d"], count: 1 },
            extras: { a: 1, b: 2 },
          });
        });

        const versions = async (criteria: unknown) => {
          const repo = getHandle().repository(TckJsonHolder);
          const results = await (repo.find as any)(criteria);
          return results
            .map((r: { metadata: Record<string, unknown> }) => r.metadata.version)
            .sort();
        };

        // `$length` on a DOCUMENT counts its KEYS. postgres errored ("cannot get
        // array length of a non-array"), sqlite silently returned nothing, and
        // mysql counted keys — right, but because `JSON_LENGTH` happens to do
        // that, not because anything decided it.
        test("$length counts the keys of a document", async () => {
          expect(await versions({ metadata: { $length: 2 } })).toEqual([1, 2]);
          expect(await versions({ metadata: { $length: 3 } })).toEqual([3]);
        });

        test("$length does not count a NULL document", async () => {
          expect(await versions({ extras: { $length: 1 } })).toEqual([2]);
          expect(await versions({ extras: { $length: 2 } })).toEqual([3]);
        });

        test("$has does not match a NULL document", async () => {
          expect(await versions({ extras: { $has: { a: 1 } } })).toEqual([2, 3]);
        });

        test("a bare nested object does not match a NULL document", async () => {
          expect(await versions({ extras: { a: 1 } })).toEqual([2, 3]);
        });

        test("$has reaches a non-string leaf", async () => {
          expect(await versions({ payload: { $has: { count: 1 } } })).toEqual([2, 3]);
          expect(await versions({ metadata: { $has: { extra: true } } })).toEqual([3]);
        });

        test("$has reaches into a nested array", async () => {
          expect(await versions({ payload: { $has: { items: ["a"] } } })).toEqual([2]);
        });

        // `$has` is PLAIN containment. An operator written inside it is a
        // LITERAL JSON key, which is what `@>` and `JSON_CONTAINS` search for —
        // so no document has it and nothing matches. A driver that evaluated it
        // as an operator would answer a question the other five cannot.
        test("an operator nested inside $has is a literal key, not an operator", async () => {
          expect(
            await versions({ metadata: { $has: { theme: { $like: "d%" } } } }),
          ).toEqual([]);
        });

        test("negated document $length keeps the other rows", async () => {
          expect(await versions({ metadata: { $not: { $length: 2 } } })).toEqual([3]);
        });
      });
    }

    // ─── Field-level condition forms ───────────────────────────────────
    //
    // Three forms that a driver could carry and none of the SQL compilers did.
    // All three USED TO MATCH EVERY ROW: a bare nested object emitted no clause,
    // a field-level `$and`/`$or` had no branch, and a `$not` payload that was
    // merely falsy was dropped — so `delete({ published: { $not: false } })`,
    // which typechecks and is the natural way to write "published is true",
    // compiled to `DELETE FROM t`.
    //
    // Every expectation below comes from running `Matcher.filter` from
    // `@lindorm/match` over these exact rows. None of it was read off a driver.

    if (caps.fieldConditions) {
      describe("Field-level $and / $or", () => {
        const { TckJsonbArray } = entities;

        beforeEach(async () => {
          await getHandle().clear();
          const repo = getHandle().repository(TckJsonbArray);
          await repo.insert({ name: "ab", label: "keep", tags: ["a", "b"] });
          await repo.insert({ name: "abc", label: "drop", tags: ["a", "b", "c"] });
          await repo.insert({ name: "cd", label: null, tags: ["c", "d"] });
          await repo.insert({ name: "xy", label: null, tags: ["x", "y", "z"] });
        });

        test("$or takes the union of its members", async () => {
          const repo = getHandle().repository(TckJsonbArray);
          const results = await repo.find(
            { name: { $or: [{ $eq: "ab" }, { $eq: "cd" }] } } as any,
            { order: { name: "ASC" } },
          );
          expect(results.map((r) => r.name)).toEqual(["ab", "cd"]);
        });

        test("$and takes the intersection of its members", async () => {
          const repo = getHandle().repository(TckJsonbArray);
          const results = await repo.find(
            { tags: { $and: [{ $all: ["a"] }, { $length: 2 }] } } as any,
            { order: { name: "ASC" } },
          );
          expect(results.map((r) => r.name)).toEqual(["ab"]);
        });

        // A member is read exactly as a field's own condition value is.
        test("reads a bare value member as an equality", async () => {
          const repo = getHandle().repository(TckJsonbArray);
          const results = await repo.find({ name: { $or: ["ab", "xy"] } } as any, {
            order: { name: "ASC" },
          });
          expect(results.map((r) => r.name)).toEqual(["ab", "xy"]);
        });

        // NULL rows: SQL's `IN`/`=` drop them, so a driver borrowing three-valued
        // logic for the members would lose "cd" and "xy" here.
        test("a null member matches the NULL rows", async () => {
          const repo = getHandle().repository(TckJsonbArray);
          const results = await repo.find({ label: { $or: [{ $eq: null }] } } as any, {
            order: { name: "ASC" },
          });
          expect(results.map((r) => r.name)).toEqual(["cd", "xy"]);
        });

        test("mixes a null member with a value member", async () => {
          const repo = getHandle().repository(TckJsonbArray);
          const results = await repo.find(
            { label: { $or: [{ $eq: null }, { $eq: "keep" }] } } as any,
            { order: { name: "ASC" } },
          );
          expect(results.map((r) => r.name)).toEqual(["ab", "cd", "xy"]);
        });

        test("$or over array operators", async () => {
          const repo = getHandle().repository(TckJsonbArray);
          const results = await repo.find(
            { tags: { $or: [{ $length: 3 }, { $all: ["a", "b"] }] } } as any,
            { order: { name: "ASC" } },
          );
          expect(results.map((r) => r.name)).toEqual(["ab", "abc", "xy"]);
        });

        test("nests $and inside $or", async () => {
          const repo = getHandle().repository(TckJsonbArray);
          const results = await repo.find(
            { name: { $or: [{ $and: [{ $eq: "ab" }] }, { $eq: "xy" }] } } as any,
            { order: { name: "ASC" } },
          );
          expect(results.map((r) => r.name)).toEqual(["ab", "xy"]);
        });

        // A logical operator among condition operators does not take over the
        // bag — every key present must hold.
        test("AND-s a field-level logical operator with its siblings", async () => {
          const repo = getHandle().repository(TckJsonbArray);
          const results = await repo.find(
            {
              label: {
                $or: [{ $eq: "keep" }, { $eq: "drop" }],
                $not: { $eq: "drop" },
              },
            } as any,
            { order: { name: "ASC" } },
          );
          expect(results.map((r) => r.name)).toEqual(["ab"]);
        });
      });

      describe("Bare nested object", () => {
        const { TckJsonHolder } = entities;

        beforeEach(async () => {
          await getHandle().clear();
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

        const versions = (rows: Array<{ metadata: Record<string, unknown> }>) =>
          rows.map((r) => r.metadata.version).sort();

        // The headline: PARTIAL, not exact. Both matching documents hold keys the
        // condition never mentions, and one holds an extra key the other lacks.
        test("matches a document that holds keys the condition never mentions", async () => {
          const repo = getHandle().repository(TckJsonHolder);
          const results = await repo.find({ metadata: { theme: "dark" } } as any);
          expect(versions(results)).toEqual([2, 3]);
        });

        test("requires every key of the condition", async () => {
          const repo = getHandle().repository(TckJsonHolder);
          const results = await repo.find({
            metadata: { theme: "dark", version: 3 },
          } as any);
          expect(versions(results)).toEqual([3]);
        });

        test("matches on a non-string leaf", async () => {
          const repo = getHandle().repository(TckJsonHolder);
          const results = await repo.find({ payload: { count: 1 } } as any);
          expect(versions(results)).toEqual([2, 3]);
        });

        test("returns nothing when no document holds the value", async () => {
          const repo = getHandle().repository(TckJsonHolder);
          const results = await (repo.find as any)({ metadata: { theme: "sepia" } });
          expect(results).toHaveLength(0);
        });

        test("intersects nested conditions across two columns", async () => {
          const repo = getHandle().repository(TckJsonHolder);
          const results = await repo.find({
            metadata: { theme: "dark" },
            settings: { count: 10 },
          } as any);
          expect(versions(results)).toEqual([3]);
        });

        // The bare form and `$has` are two spellings of ONE semantic.
        test("means the same as the equivalent $has", async () => {
          const repo = getHandle().repository(TckJsonHolder);
          const bare = await repo.find({ metadata: { theme: "dark" } } as any);
          const has = await repo.find({ metadata: { $has: { theme: "dark" } } } as any);
          expect(versions(bare)).toEqual(versions(has));
        });

        test("AND-s a nested key with a sibling operator", async () => {
          const repo = getHandle().repository(TckJsonHolder);
          const results = await repo.find({
            metadata: { $exists: true, theme: "dark" },
          } as any);
          expect(versions(results)).toEqual([2, 3]);
        });

        test("negates through $not", async () => {
          const repo = getHandle().repository(TckJsonHolder);
          const results = await repo.find({
            metadata: { $not: { theme: "dark" } },
          } as any);
          expect(versions(results)).toEqual([1]);
        });
      });

      describe("Malformed operator payloads", () => {
        const { TckJsonbArray } = entities;

        beforeEach(async () => {
          await getHandle().clear();
          const repo = getHandle().repository(TckJsonbArray);
          await repo.insert({ name: "ab", label: "keep", tags: ["a", "b"] });
          await repo.insert({ name: "abc", label: "drop", tags: ["a", "b", "c"] });
          await repo.insert({ name: "cd", label: null, tags: ["c", "d"] });
          await repo.insert({ name: "xy", label: null, tags: ["x", "y", "z"] });
        });

        test.each([
          ["a falsy $not", { label: { $not: false } }],
          ["a truthy non-object $not", { label: { $not: "drop" } }],
          ["a Date $not", { label: { $not: new Date("2026-08-09T00:00:00.000Z") } }],
          ["a string $regex", { label: { $regex: "keep" } }],
          ["an empty $or", { label: { $or: [] } }],
          ["an empty $and", { label: { $and: [] } }],
          // A null OPERAND to a comparison operator. The row-value side is a
          // different concern and stays: a row whose column is null simply does
          // not match, which is what every driver already does. But `$gte: null`
          // asks for "greater than or equal to nothing" — it is not orderable,
          // so it is a malformed payload, exactly as a non-object `$not` is. It
          // used to bind as a parameter, and `label >= NULL` is UNKNOWN for
          // every row, so a condition that is an error returned an empty result
          // set instead.
          ["a null $gt operand", { label: { $gt: null } }],
          ["a null $gte operand", { label: { $gte: null } }],
          ["a null $lt operand", { label: { $lt: null } }],
          ["a null $lte operand", { label: { $lte: null } }],
          ["a null $between payload", { label: { $between: null } }],
          ["a null $between bound", { label: { $between: [null, "z"] } }],
          ["a null $mod payload", { version: { $mod: null } }],
          ["a null $mod divisor", { version: { $mod: [null, 0] } }],
        ])("refuses %s", async (_label, criteria) => {
          const repo = getHandle().repository(TckJsonbArray);
          await expect((repo.find as any)(criteria)).rejects.toThrow();
        });

        // The row-value side, which does NOT throw: two rows hold NULL and a
        // comparison simply does not match them.
        test("a comparison over a nullable column filters the NULL rows out", async () => {
          const repo = getHandle().repository(TckJsonbArray);
          const results = await repo.find({ label: { $gte: "drop" } } as any, {
            order: { name: "ASC" },
          });
          expect(results.map((r) => r.name)).toEqual(["ab", "abc"]);
        });

        // The wipe this phase exists for. `{ label: { $not: false } }` has ONE
        // criteria key, so the empty-criteria guard passed it, and it compiled to
        // a DELETE with no WHERE clause at all.
        test("refuses a delete written with a falsy $not, and every row survives", async () => {
          const repo = getHandle().repository(TckJsonbArray);

          await expect(
            (repo.delete as any)({ label: { $not: false } }),
          ).rejects.toThrow();

          const survivors = await repo.find({} as any, { order: { name: "ASC" } });
          expect(survivors.map((r) => r.name)).toEqual(["ab", "abc", "cd", "xy"]);
        });
      });
    }
  });
};
