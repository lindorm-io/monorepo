import { Matcher } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import { describe, expect, test } from "vitest";
import { constrainsNothing } from "./constrains-nothing.js";

/**
 * An actor no row ADMITS by name, so a condition that refuses it is one that
 * constrains. Every row states what `@lindorm/match` does with the condition as
 * well as what the predicate says about it: the predicate's whole claim is about
 * how the MATCHER resolves a shape, so a table read off the predicate alone would
 * agree with itself and prove nothing.
 */
const ROGUE: Dict = { subject: "rogue", issuer: "https://rogue.lindorm.io/" };

type Row = {
  label: string;
  condition: Dict;
  constrainsNothing: boolean;
  admitsRogue: boolean;
};

const ROWS: Array<Row> = [
  {
    label: "a condition naming no field",
    condition: {},
    constrainsNothing: true,
    admitsRogue: true,
  },
  {
    label: "a condition whose only key is undefined",
    condition: { subject: undefined },
    constrainsNothing: true,
    admitsRogue: true,
  },
  {
    label: "a condition whose every key is undefined",
    condition: { subject: undefined, issuer: undefined },
    constrainsNothing: true,
    admitsRogue: true,
  },
  {
    label: "a conjunction whose only member names no field",
    condition: { $and: [{}] },
    constrainsNothing: true,
    admitsRogue: true,
  },
  {
    label: "a conjunction whose every member names no field",
    condition: { $and: [{}, { subject: undefined }] },
    constrainsNothing: true,
    admitsRogue: true,
  },
  {
    label: "a conjunction of a member whose only key is undefined",
    condition: { $and: [{ subject: undefined }] },
    constrainsNothing: true,
    admitsRogue: true,
  },
  {
    label: "an alternation whose only member names no field",
    condition: { $or: [{}] },
    constrainsNothing: true,
    admitsRogue: true,
  },
  {
    label: "an alternation offering one member that names no field",
    condition: { $or: [{ subject: "nobody" }, {}] },
    constrainsNothing: true,
    admitsRogue: true,
  },
  {
    label: "a denial of a condition no actor satisfies",
    condition: { $not: { $not: {} } },
    constrainsNothing: true,
    admitsRogue: true,
  },
  // A logical operator UNDER a denial, where the quantifier flips: a `$and` is
  // unsatisfiable as soon as ONE member is, an `$or` only once EVERY member is,
  // so denying either admits every actor.
  {
    label: "a denial of a conjunction one member makes unsatisfiable",
    condition: { $not: { $and: [{ $not: {} }, {}] } },
    constrainsNothing: true,
    admitsRogue: true,
  },
  {
    label: "a denial of a conjunction whose only member is unsatisfiable",
    condition: { $not: { $and: [{ $not: {} }] } },
    constrainsNothing: true,
    admitsRogue: true,
  },
  {
    label: "a denial of an alternation whose only member is unsatisfiable",
    condition: { $not: { $or: [{ $not: {} }] } },
    constrainsNothing: true,
    admitsRogue: true,
  },
  {
    label: "a conjunction nesting an alternation that names no field",
    condition: { $and: [{ $or: [{}] }] },
    constrainsNothing: true,
    admitsRogue: true,
  },
  {
    label: "a conjunction whose members each reduce to naming no field",
    condition: { $and: [{ $or: [{ subject: "a" }, {}] }, {}] },
    constrainsNothing: true,
    admitsRogue: true,
  },

  // A logical operator's member is read for its ENTRIES, not for its type: the
  // matcher recurses into one with `Object.entries` and no shape check, so any
  // value carrying no defined own key is a member every actor satisfies.
  {
    label: "a conjunction whose only member is an empty array",
    condition: { $and: [[]] },
    constrainsNothing: true,
    admitsRogue: true,
  },
  {
    label: "an alternation whose only member is an empty array",
    condition: { $or: [[]] },
    constrainsNothing: true,
    admitsRogue: true,
  },
  {
    label: "an alternation offering an empty array beside a named field",
    condition: { $or: [{ subject: "a" }, []] },
    constrainsNothing: true,
    admitsRogue: true,
  },
  {
    label: "a conjunction whose only member is an array of undefined",
    condition: { $and: [[undefined]] },
    constrainsNothing: true,
    admitsRogue: true,
  },
  {
    label: "a conjunction whose only member is a date",
    condition: { $and: [new Date()] },
    constrainsNothing: true,
    admitsRogue: true,
  },
  {
    label: "a conjunction whose only member is a number",
    condition: { $and: [5] },
    constrainsNothing: true,
    admitsRogue: true,
  },
  {
    label: "a conjunction whose only member is an empty string",
    condition: { $and: [""] },
    constrainsNothing: true,
    admitsRogue: true,
  },

  {
    label: "a named field",
    condition: { subject: "service-1" },
    constrainsNothing: false,
    admitsRogue: false,
  },
  {
    label: "a value set",
    condition: { subject: { $in: ["a", "b"] } },
    constrainsNothing: false,
    admitsRogue: false,
  },
  {
    label: "an alternation of named fields",
    condition: { $or: [{ subject: "a" }, { subject: "b" }] },
    constrainsNothing: false,
    admitsRogue: false,
  },
  {
    label: "a denial naming a field",
    condition: { $not: { subject: "rogue" } },
    constrainsNothing: false,
    admitsRogue: false,
  },
  {
    label: "an absence check",
    condition: { subject: { $exists: false } },
    constrainsNothing: false,
    admitsRogue: false,
  },
  {
    label: "a conjunction naming no field beside a named field",
    condition: { $and: [{}], subject: "service-1" },
    constrainsNothing: false,
    admitsRogue: false,
  },
  {
    label: "an alternation naming no field beside a named field",
    condition: { $or: [{}], subject: "service-1" },
    constrainsNothing: false,
    admitsRogue: false,
  },
  {
    label: "an alternation whose only member conjoins a named field",
    condition: { $or: [{ $and: [{ subject: "a" }, {}] }] },
    constrainsNothing: false,
    admitsRogue: false,
  },
  {
    label: "a denial of a condition every actor satisfies",
    condition: { $not: {} },
    constrainsNothing: false,
    admitsRogue: false,
  },
  {
    label: "a denial of a conjunction every actor satisfies",
    condition: { $not: { $and: [{}] } },
    constrainsNothing: false,
    admitsRogue: false,
  },
  {
    label: "a double denial of a named field",
    condition: { $not: { $not: { subject: "a" } } },
    constrainsNothing: false,
    admitsRogue: false,
  },
  // The other quantifier under a denial: an `$or` stays satisfiable while ONE
  // member is, so denying it refuses the actors that member names.
  {
    label: "a denial of an alternation offering a satisfiable member",
    condition: { $not: { $or: [{ $not: {} }, { subject: "rogue" }] } },
    constrainsNothing: false,
    admitsRogue: false,
  },
  // The other side of the entries reading: an array member carrying a key names
  // the field `"0"`, so it constrains exactly as an object member would.
  {
    label: "a conjunction whose only member is a populated array",
    condition: { $and: [["a"]] },
    constrainsNothing: false,
    admitsRogue: false,
  },
];

describe("constrainsNothing", () => {
  for (const row of ROWS) {
    test(`${row.label} ${row.constrainsNothing ? "constrains nothing" : "constrains"}`, () => {
      expect(constrainsNothing(row.condition)).toBe(row.constrainsNothing);
      expect(Matcher.match(ROGUE, row.condition)).toBe(row.admitsRogue);
    });
  }

  // The soundness direction, derived from the predicate rather than from the
  // column beside it: calling a condition constraining nothing when the matcher
  // would have refused an actor by it rejects a filter its author meant.
  test("calls no condition constraining nothing that the matcher refuses an unnamed actor by", () => {
    for (const row of ROWS.filter((candidate) =>
      constrainsNothing(candidate.condition),
    )) {
      expect(Matcher.match(ROGUE, row.condition)).toBe(true);
    }
  });

  // The one degenerate shape the predicate does not analyse, because the matcher
  // refuses it outright instead of reading `[]` as an identity element — so it
  // cannot become a silent match. This is the premise the `isLogicalArray`
  // length check rests on.
  test("a logical operator with no members is refused by the matcher", () => {
    expect(constrainsNothing({ $and: [] })).toBe(false);
    expect(constrainsNothing({ $or: [] })).toBe(false);

    expect(() => Matcher.match(ROGUE, { $and: [] })).toThrow(TypeError);
    expect(() => Matcher.match(ROGUE, { $or: [] })).toThrow(TypeError);
  });

  // The two member values `Object.entries` cannot read, and therefore the only
  // ones the rows above cannot state: the matcher throws on them instead of
  // answering, so counting them as constraining cannot become a silent match.
  // That is the premise the `isReadableMember` guard rests on. `Condition` refuses
  // both, which is what the casts are for — drop one and `typecheck` goes red.
  test("a logical operator member that cannot be read is refused by the matcher", () => {
    expect(constrainsNothing({ $and: [null] })).toBe(false);
    expect(constrainsNothing({ $or: [undefined] })).toBe(false);

    expect(() => Matcher.match(ROGUE, { $and: [null] } as never)).toThrow(TypeError);
    expect(() => Matcher.match(ROGUE, { $or: [undefined] } as never)).toThrow(TypeError);
  });

  // The root keys the default branch absorbs beside a named field. A
  // `$`-prefixed key has no field to apply to there, so the matcher refuses it
  // outright instead of answering — an unknown one as much as an operator it
  // knows — which is why counting it as constraining cannot become a silent
  // match.
  test("a `$`-prefixed key at the root of a condition is refused by the matcher", () => {
    expect(constrainsNothing({ $in: ["a"] })).toBe(false);
    expect(constrainsNothing({ $bogus: 1 })).toBe(false);

    expect(() => Matcher.match(ROGUE, { $in: ["a"] } as never)).toThrow(TypeError);
    expect(() => Matcher.match(ROGUE, { $bogus: 1 } as never)).toThrow(TypeError);
  });
});
