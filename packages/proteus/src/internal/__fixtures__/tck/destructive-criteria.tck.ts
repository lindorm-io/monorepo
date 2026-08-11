import { describe, test, expect, beforeEach } from "vitest";
// TCK: Destructive Criteria Suite
//
// Every assertion here counts ROWS on the real driver, never a compiled SQL
// string: the failure mode this suite exists for is a silently emptied table,
// and a string assertion that agrees with the bug is exactly how that survives.
//
// Verified at the time of writing, against a real sqlite database and the
// memory driver: `delete({ $and: [] })` and `delete({ name: {} })` left ZERO of
// three rows on sqlite, `delete({ name: undefined })` left zero on memory, and
// `updateMany({}, …)` rewrote every row on memory. All four passed the guard
// that counted criteria keys.

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";
import type { TckCapabilities } from "./types.js";

/** Run a write to completion and report only WHETHER it was refused. */
const settle = async (promise: Promise<unknown>): Promise<"resolved" | "rejected"> =>
  promise.then(
    () => "resolved" as const,
    () => "rejected" as const,
  );

export const destructiveCriteriaSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
  caps: TckCapabilities,
) => {
  describe("Destructive criteria", () => {
    const { TckSimpleUser, TckUnversioned, TckSoftDeletable, TckWithAddress } = entities;

    const seed = async (): Promise<void> => {
      const repo = getHandle().repository(TckUnversioned);
      await repo.insert({ name: "A", score: 1 });
      await repo.insert({ name: "B", score: 2 });
      await repo.insert({ name: "C", score: 3 });
    };

    beforeEach(async () => {
      await getHandle().clear();
      await seed();
    });

    // ─── The guard refuses what restricts nothing ──────────────────────────

    // Each of these is well-formed and correctly typed. Counting criteria KEYS
    // let every one of them through.
    describe.each([
      ["an empty criteria object", {}],
      ["an empty $and", { $and: [] }],
      ["a criteria key whose value is undefined", { name: undefined }],
      ["an empty operator bag on a named field", { name: {} }],
      ["an operator bag whose only value is undefined", { name: { $eq: undefined } }],
      ["an empty $nin exclusion list", { name: { $nin: [] } }],
    ])("%s", (_label, criteria) => {
      // The ROW COUNT is asserted first and unconditionally. Asserting only
      // "it rejects" would let a run where the rows are already gone fail on
      // the wrong line and never check the table at all.
      test("delete leaves every row in place", async () => {
        const repo = getHandle().repository(TckUnversioned);

        const outcome = await settle(repo.delete(criteria as any));

        expect(await repo.find()).toHaveLength(3);
        expect(outcome).toBe("rejected");
      });

      test("updateMany leaves every row untouched", async () => {
        const repo = getHandle().repository(TckUnversioned);

        const outcome = await settle(repo.updateMany(criteria as any, { score: 99 }));

        const rows = await repo.find();
        expect(rows.map((r) => r.score).sort()).toEqual([1, 2, 3]);
        expect(outcome).toBe("rejected");
      });
    });

    // ─── The containment operators, whose empty operand is the same trap ────
    //
    // An empty list reaching a CONTAINMENT operator is the identical accident
    // `$nin: []` is — a caller-supplied list that came back empty — and the
    // guard's analysis rated every one of them as restricting whatever the
    // operand held. Only one of them is actually unrestricted, and which one is
    // not guessable: every expectation below is `Matcher.filter` from
    // `@lindorm/match` over three rows holding `["a","b"]`, `["a","b","c"]` and
    // `["c","d"]`.
    //
    // - `$overlap: []` selects NO row, so `$not: { $overlap: [] }` selects EVERY
    //   row — including one whose column is NULL. That is the wipe.
    // - `$all: []`, `$has: []` and the bare `[]` select every row holding a
    //   LIST and no NULL, which is the restriction `$exists: true` places, so
    //   they stay allowed.
    // - `$contained: []` selects only a row whose own list is EMPTY.
    describe("empty containment operands", () => {
      const { TckJsonbArray } = entities;

      const seedTags = async (): Promise<void> => {
        const repo = getHandle().repository(TckJsonbArray);
        await repo.insert({ name: "ab", tags: ["a", "b"], extras: ["x"] });
        await repo.insert({ name: "abc", tags: ["a", "b", "c"], extras: [] });
        await repo.insert({ name: "cd", tags: ["c", "d"], extras: null });
      };

      beforeEach(async () => {
        await getHandle().clear();
        await seedTags();
      });

      // Reproduced before the fix on the memory driver: three rows in, ZERO
      // out, no error — the guard rated `$overlap: []` as restricting whatever
      // its operand held, so the negation looked restrictive too.
      test.each([
        ["a negated empty $overlap", { tags: { $not: { $overlap: [] } } }],
        ["a criteria-level negated empty $overlap", { $not: { tags: { $overlap: [] } } }],
      ])("delete refuses %s and leaves every row", async (_label, criteria) => {
        const repo = getHandle().repository(TckJsonbArray);

        const outcome = await settle(repo.delete(criteria as any));

        expect(await repo.find()).toHaveLength(3);
        expect(outcome).toBe("rejected");
      });

      // The other empty forms are RESTRICTIVE, and refusing them would make the
      // guard fail closed on a legitimate delete. The guard lets them through on
      // every driver; what they then REMOVE is the structured-operator question,
      // so the row counts — each one `Matcher.filter` over the same rows — are
      // asserted only where those operators are conformant.
      if (caps.structuredOperators) {
        test("delete accepts an empty $overlap and removes nothing", async () => {
          const repo = getHandle().repository(TckJsonbArray);

          await repo.delete({ tags: { $overlap: [] } } as any);

          expect(await repo.find()).toHaveLength(3);
        });

        test("delete accepts an empty $contained and removes only the empty list", async () => {
          const repo = getHandle().repository(TckJsonbArray);

          const outcome = await settle(
            repo.delete({ extras: { $contained: [] } } as any),
          );

          expect(outcome).toBe("resolved");
          const rows = await repo.find();
          expect(rows.map((r) => r.name).sort()).toEqual(["ab", "cd"]);
        });

        test("delete accepts a bare empty array and removes every row holding a list", async () => {
          const repo = getHandle().repository(TckJsonbArray);

          const outcome = await settle(repo.delete({ extras: [] } as any));

          expect(outcome).toBe("resolved");
          const rows = await repo.find();
          expect(rows.map((r) => r.name)).toEqual(["cd"]);
        });
      }
    });

    // `$in: []` can never hold, so it deletes nothing — a legitimate outcome,
    // and the opposite state from `$nin: []`. Refusing it would make "match
    // nothing" harder to write than "match everything".
    test("delete accepts an empty $in list and removes nothing", async () => {
      const repo = getHandle().repository(TckUnversioned);

      await repo.delete({ name: { $in: [] } });

      expect(await repo.find()).toHaveLength(3);
    });

    test("delete still removes the rows a real criterion names", async () => {
      const repo = getHandle().repository(TckUnversioned);

      await repo.delete({ name: "B" });

      const rows = await repo.find();
      expect(rows.map((r) => r.name).sort()).toEqual(["A", "C"]);
    });

    // A field-level `$and` / `$or` is the one criteria shape the guard CANNOT
    // vouch for. The analysis reads the CALLER's condition, so an operator the
    // caller wrote is counted as restricting whether or not the driver honours
    // it — a compiler that dropped the key would sail through the guard and
    // then emit an unbounded DELETE. Reproduced by removing the two branches
    // from the SQL compiler: three rows in, ZERO out, no error raised.
    //
    // The read-path cases for these operators live in the complex-predicates
    // suite; only a row count on the DESTRUCTIVE path catches this, and a
    // compiled-SQL assertion never would.
    if (caps.fieldConditions) {
      test("delete honours a field-level $and", async () => {
        const repo = getHandle().repository(TckUnversioned);

        await repo.delete({ name: { $and: [{ $eq: "B" }] } } as any);

        const rows = await repo.find();
        expect(rows.map((r) => r.name).sort()).toEqual(["A", "C"]);
      });

      test("delete honours a field-level $or", async () => {
        const repo = getHandle().repository(TckUnversioned);

        await repo.delete({ name: { $or: [{ $eq: "A" }, { $eq: "C" }] } } as any);

        const rows = await repo.find();
        expect(rows.map((r) => r.name)).toEqual(["B"]);
      });

      test("updateMany honours a field-level $or", async () => {
        const repo = getHandle().repository(TckUnversioned);

        await repo.updateMany({ name: { $or: [{ $eq: "A" }, { $eq: "C" }] } } as any, {
          score: 99,
        });

        const rows = await repo.find(undefined, { order: { name: "ASC" } });
        expect(rows.map((r) => r.score)).toEqual([99, 2, 99]);
      });
    }

    // Root `{}` is how you ask a READ for everything, and it must keep working.
    // The destructive path is guarded separately, so preserving it costs
    // nothing.
    test("find({}) still returns every row", async () => {
      const repo = getHandle().repository(TckUnversioned);

      expect(await repo.find({})).toHaveLength(3);
    });

    // Reads are NOT guarded, so these prove the compiler itself — naming a field
    // and constraining nothing is an error in the language, not a criterion that
    // quietly matches every row. Without this the destructive assertions above
    // would pass on the guard alone and never exercise the driver.
    test.each([
      ["an empty operator bag on a named field", { name: {} }],
      ["an operator bag whose only value is undefined", { name: { $eq: undefined } }],
      ["an empty $and", { $and: [] }],
      ["an empty $or", { $or: [] }],
    ])("find refuses %s", async (_label, criteria) => {
      const repo = getHandle().repository(TckUnversioned);

      await expect(repo.find(criteria as any)).rejects.toThrow();
    });

    // `undefined` is "not supplied", so the key is not there at all — which at
    // the ROOT of a read leaves no constraint, exactly like `{}`.
    test("find ignores a criteria key whose value is undefined", async () => {
      const repo = getHandle().repository(TckUnversioned);

      expect(await repo.find({ name: undefined } as any)).toHaveLength(3);
    });

    // An @Embedded parent key expands to COLUMNS rather than compiling to JSON
    // containment — a different mechanism for the same semantic, and therefore a
    // second place the empty-bag rule has to hold. Falling through emitted no
    // clause at all.
    test("delete refuses an empty condition on an embedded parent key", async () => {
      const repo = getHandle().repository(TckWithAddress);
      await repo.insert({
        name: "embedded-a",
        address: { street: "Karl Johans gate 1", city: "Oslo", country: "NO" },
      });
      await repo.insert({
        name: "embedded-b",
        address: { street: "Storgata 2", city: "Bergen", country: "NO" },
      });

      const outcome = await settle(repo.delete({ address: {} } as any));

      expect(await repo.find()).toHaveLength(2);
      expect(outcome).toBe("rejected");

      // The READ path is unguarded, so this is what proves the expansion itself
      // refuses the shape rather than the repository guard doing it first.
      await expect(repo.find({ address: {} } as any)).rejects.toThrow();
    });

    test("delete still expands a constrained embedded parent key", async () => {
      const repo = getHandle().repository(TckWithAddress);
      await repo.insert({
        name: "embedded-c",
        address: { street: "Karl Johans gate 1", city: "Oslo", country: "NO" },
      });
      await repo.insert({
        name: "embedded-d",
        address: { street: "Storgata 2", city: "Bergen", country: "NO" },
      });

      await repo.delete({ address: { city: "Oslo" } } as any);

      const rows = await repo.find();
      expect(rows.map((r) => r.name)).toEqual(["embedded-d"]);
    });

    // ─── Saying "every row" explicitly ─────────────────────────────────────

    test("deleteAll removes every row", async () => {
      const repo = getHandle().repository(TckUnversioned);

      await repo.deleteAll();

      expect(await repo.find()).toHaveLength(0);
    });

    test("updateAll rewrites every row", async () => {
      const repo = getHandle().repository(TckUnversioned);

      await repo.updateAll({ score: 42 });

      const rows = await repo.find();
      expect(rows).toHaveLength(3);
      expect(rows.map((r) => r.score)).toEqual([42, 42, 42]);
      // The rows are UPDATED, not replaced — the untouched column survives.
      expect(rows.map((r) => r.name).sort()).toEqual(["A", "B", "C"]);
    });

    test("truncate removes every row", async () => {
      const repo = getHandle().repository(TckUnversioned);

      await repo.truncate();

      expect(await repo.find()).toHaveLength(0);
    });

    // ─── An undefined UPDATE value leaves the column alone ─────────────────

    // `undefined` means "the key was not supplied" on the write side too. Every
    // driver used to write NULL for it, so a spread-built partial update nulled
    // every field the caller had not set — and on a NOT NULL column it failed
    // the whole statement.
    test("updateMany ignores an undefined value rather than nulling the column", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const user = await repo.insert({ name: "Keep", email: "keep@test.com", age: 1 });

      await repo.updateMany({ id: user.id }, { email: undefined, age: 7 } as any);

      const found = await repo.findOneOrFail({ id: user.id });
      expect(found.age).toBe(7);
      expect(found.email).toBe("keep@test.com");
    });

    // `null` is a real value, not a synonym for "not supplied" — it stays in
    // the update set and clears the column.
    test("updateMany still writes an explicit null", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const user = await repo.insert({ name: "Clear", email: "clear@test.com" });

      await repo.updateMany({ id: user.id }, { email: null } as any);

      const found = await repo.findOneOrFail({ id: user.id });
      expect(found.email).toBeNull();
    });

    // ─── Soft delete and restore are NOT guarded ───────────────────────────

    // Both are reversible by construction, so the blast-radius argument that
    // justifies the guard does not reach them — and a guard whose only escape
    // is a criterion that tricks it is worse than no guard at all.
    if (caps.softDelete) {
      test("softDelete accepts empty criteria and soft-deletes every row", async () => {
        const repo = getHandle().repository(TckSoftDeletable);
        await repo.insert({ name: "S1" });
        await repo.insert({ name: "S2" });

        await repo.softDelete({});

        expect(await repo.find()).toHaveLength(0);
        expect(await repo.find({}, { withDeleted: true })).toHaveLength(2);
      });

      test("restore accepts empty criteria and restores every row", async () => {
        const repo = getHandle().repository(TckSoftDeletable);
        await repo.insert({ name: "R1" });
        await repo.insert({ name: "R2" });
        await repo.softDelete({});

        await repo.restore({});

        expect(await repo.find()).toHaveLength(2);
      });
    }
  });
};
