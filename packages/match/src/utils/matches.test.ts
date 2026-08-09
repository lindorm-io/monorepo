import { describe, expect, test } from "vitest";
import type { Condition } from "../types/condition.js";
import { matches } from "./matches.js";

/**
 * The condition language's own rules, as opposed to `Matcher.test.ts` which
 * exercises the query surface. Each block names the rule it pins.
 */

type Row = {
  id: string;
  age: number | null;
  name: string;
  big: bigint;
  createdAt: Date;
  active: boolean;
  tags: Array<string>;
  address: { city: string; zip: string } | null;
  payload: { city: string; count: number };
};

const row = (partial: Partial<Row> = {}): Row => ({
  id: "1",
  age: 20,
  name: "John",
  big: 10n,
  createdAt: new Date("2020-01-01"),
  active: true,
  tags: ["alpha", "beta"],
  address: { city: "Oslo", zip: "0150" },
  payload: { city: "Oslo", count: 2 },
  ...partial,
});

describe("R6/R3 — undefined is ABSENT, and it is stripped BEFORE shape validation", () => {
  test("a condition value of undefined places no constraint", () => {
    expect(matches(row(), { name: undefined })).toBe(true);
  });

  test("an operator value of undefined makes the whole criterion absent", () => {
    expect(matches(row({ age: 20 }), { age: { $eq: undefined } })).toBe(true);
  });

  test("an undefined operator is stripped, its defined siblings still apply", () => {
    expect(matches(row({ age: 20 }), { age: { $gt: undefined, $lt: 40 } })).toBe(true);
    expect(matches(row({ age: 50 }), { age: { $gt: undefined, $lt: 40 } })).toBe(false);
  });

  test("stripping happens BEFORE shape validation — an undefined $exists does not throw", () => {
    expect(matches(row(), { age: { $exists: undefined } })).toBe(true);
  });

  test("stripping happens BEFORE shape validation — an undefined $and does not throw", () => {
    expect(matches(row(), { $and: undefined })).toBe(true);
  });

  test("null is NOT undefined — an explicit null still constrains", () => {
    expect(matches(row({ age: null }), { age: { $eq: null } })).toBe(true);
    expect(matches(row({ age: 20 }), { age: { $eq: null } })).toBe(false);
  });
});

describe("R2 — a malformed operator payload THROWS", () => {
  test("$not on a non-object throws (string)", () => {
    expect(() => matches(row(), { name: { $not: "John" } as any })).toThrow(/\$not/);
  });

  test("$not on a Date throws — the reference-compare tenant leak", () => {
    expect(() => matches(row(), { createdAt: { $not: new Date() } as any })).toThrow(
      /\$not/,
    );
  });

  test("$not on an array throws", () => {
    expect(() => matches(row(), { tags: { $not: ["alpha"] } as any })).toThrow(/\$not/);
  });

  test("$not on a boolean throws — the mass-delete shape", () => {
    expect(() => matches(row(), { active: { $not: false } as any })).toThrow(/\$not/);
  });

  test("$and on a non-array throws", () => {
    expect(() => matches(row(), { $and: { name: "John" } as any })).toThrow(/\$and/);
  });

  test("$or on a non-array throws", () => {
    expect(() => matches(row(), { $or: "John" as any })).toThrow(/\$or/);
  });

  test("$in on a non-array throws", () => {
    expect(() => matches(row(), { name: { $in: "John" as any } })).toThrow(/\$in/);
  });

  test("$nin / $all / $overlap / $contained on a non-array throw", () => {
    expect(() => matches(row(), { name: { $nin: "John" as any } })).toThrow(/\$nin/);
    expect(() => matches(row(), { tags: { $all: "alpha" as any } })).toThrow(/\$all/);
    expect(() => matches(row(), { tags: { $overlap: "alpha" as any } })).toThrow(
      /\$overlap/,
    );
    expect(() => matches(row(), { tags: { $contained: "alpha" as any } })).toThrow(
      /\$contained/,
    );
  });

  test("$between on a non-pair throws", () => {
    expect(() => matches(row(), { age: { $between: [1] as any } })).toThrow(/\$between/);
    expect(() => matches(row(), { age: { $between: 1 as any } })).toThrow(/\$between/);
  });

  test("$exists on a non-boolean throws", () => {
    expect(() => matches(row(), { age: { $exists: "yes" as any } })).toThrow(/\$exists/);
  });

  test("$length on a non-number throws", () => {
    expect(() => matches(row(), { tags: { $length: "2" as any } })).toThrow(/\$length/);
  });

  test("$regex on a string throws — the language declares a RegExp", () => {
    expect(() => matches(row(), { name: { $regex: "^John" as any } })).toThrow(/\$regex/);
  });

  test("$like / $ilike on a non-string throw", () => {
    expect(() => matches(row(), { name: { $like: 5 as any } })).toThrow(/\$like/);
    expect(() => matches(row(), { name: { $ilike: 5 as any } })).toThrow(/\$ilike/);
  });

  test("an unknown $-prefixed operator throws", () => {
    expect(() => matches(row(), { name: { $eqq: "John" } as any })).toThrow(/\$eqq/);
  });
});

describe("R15 — field-level logical operators AND with their siblings", () => {
  const rows = [
    row({ id: "a", age: 10 }),
    row({ id: "b", age: 20 }),
    row({ id: "c", age: 30 }),
  ];

  test("a $not sibling no longer discards the condition operators beside it", () => {
    const condition = { age: { $not: { $lt: 15 }, $lt: 25 } };
    expect(rows.filter((r) => matches(r, condition)).map((r) => r.id)).toEqual(["b"]);
  });

  test("an $or sibling no longer discards the condition operators beside it", () => {
    const condition = { age: { $or: [{ $lt: 15 }, { $gt: 25 }], $lt: 25 } };
    expect(rows.filter((r) => matches(r, condition)).map((r) => r.id)).toEqual(["a"]);
  });

  test("the SAME rule applies inside an $and member — precedence is no longer inverted", () => {
    const condition = { age: { $and: [{ $not: { $lt: 15 }, $lt: 25 }] } };
    expect(rows.filter((r) => matches(r, condition)).map((r) => r.id)).toEqual(["b"]);
  });

  test("the SAME rule applies inside an $or member", () => {
    const condition = { age: { $or: [{ $not: { $lt: 15 }, $lt: 25 }] } };
    expect(rows.filter((r) => matches(r, condition)).map((r) => r.id)).toEqual(["b"]);
  });

  test("the SAME rule applies inside a $not payload", () => {
    const condition = { age: { $not: { $not: { $lt: 15 }, $lt: 25 } } };
    expect(rows.filter((r) => matches(r, condition)).map((r) => r.id)).toEqual([
      "a",
      "c",
    ]);
  });
});

describe("R13 — null on the VALUE side does not match; null on the OPERAND side throws", () => {
  test("a null row value with a comparison operator does not match, and does not throw", () => {
    expect(matches(row({ age: null }), { age: { $gt: 5 } })).toBe(false);
    expect(matches(row({ age: null }), { age: { $gte: 5 } })).toBe(false);
    expect(matches(row({ age: null }), { age: { $lt: 5 } })).toBe(false);
    expect(matches(row({ age: null }), { age: { $lte: 5 } })).toBe(false);
    expect(matches(row({ age: null }), { age: { $between: [1, 5] } })).toBe(false);
    expect(matches(row({ age: null }), { age: { $mod: [2, 0] } })).toBe(false);
  });

  test("an ABSENT row value behaves the same as null", () => {
    const partial = { id: "1" } as any;
    expect(matches(partial, { age: { $gt: 5 } })).toBe(false);
    expect(matches(partial, { age: { $between: [1, 5] } })).toBe(false);
  });

  test("one null row no longer poisons the whole query", () => {
    const rows = [row({ id: "a", age: null }), row({ id: "b", age: 30 })];
    expect(rows.filter((r) => matches(r, { age: { $gt: 5 } })).map((r) => r.id)).toEqual([
      "b",
    ]);
  });

  test("a null OPERAND on a comparison operator throws", () => {
    expect(() => matches(row(), { age: { $gt: null as any } })).toThrow(/\$gt/);
    expect(() => matches(row(), { age: { $gte: null as any } })).toThrow(/\$gte/);
    expect(() => matches(row(), { age: { $lt: null as any } })).toThrow(/\$lt/);
    expect(() => matches(row(), { age: { $lte: null as any } })).toThrow(/\$lte/);
    expect(() => matches(row(), { age: { $between: [null, 5] as any } })).toThrow(
      /\$between/,
    );
  });

  test("$eq: null and $neq: null stay legitimate", () => {
    expect(matches(row({ age: null }), { age: { $eq: null } })).toBe(true);
    expect(matches(row({ age: null }), { age: { $neq: null } })).toBe(false);
    expect(matches(row({ age: 20 }), { age: { $neq: null } })).toBe(true);
  });
});

describe("R12/M-6 — one definition of equality, the one $eq uses", () => {
  const instant = new Date("2020-01-01");

  test("a bare Date condition value compares by VALUE, not reference", () => {
    expect(
      matches(row({ createdAt: instant }), { createdAt: new Date("2020-01-01") }),
    ).toBe(true);
  });

  test("$in over Dates compares by instant", () => {
    expect(
      matches(row({ createdAt: instant }), {
        createdAt: { $in: [new Date("2020-01-01")] },
      }),
    ).toBe(true);
  });

  test("$nin over Dates EXCLUDES by instant", () => {
    expect(
      matches(row({ createdAt: instant }), {
        createdAt: { $nin: [new Date("2020-01-01")] },
      }),
    ).toBe(false);
  });

  test("$all / $overlap / $contained over object elements compare by structure", () => {
    const rec = { dates: [{ at: new Date("2020-01-01") }] };
    expect(matches(rec, { dates: { $all: [{ at: new Date("2020-01-01") }] } })).toBe(
      true,
    );
    expect(matches(rec, { dates: { $overlap: [{ at: new Date("2020-01-01") }] } })).toBe(
      true,
    );
    expect(
      matches(rec, {
        dates: { $contained: [{ at: new Date("2020-01-01") }, { at: new Date() }] },
      }),
    ).toBe(true);
  });

  test("a bare array of Dates inherits the same comparison", () => {
    const rec = { dates: [new Date("2020-01-01")] };
    expect(matches(rec, { dates: [new Date("2020-01-01")] })).toBe(true);
  });
});

describe("R14 — range operators accept number | Date | bigint | string", () => {
  test("strings order by plain JS comparison", () => {
    expect(matches(row({ name: "John" }), { name: { $gt: "Alice" } })).toBe(true);
    expect(matches(row({ name: "John" }), { name: { $lt: "Alice" } })).toBe(false);
    expect(matches(row({ name: "John" }), { name: { $gte: "John" } })).toBe(true);
    expect(matches(row({ name: "John" }), { name: { $lte: "John" } })).toBe(true);
    expect(matches(row({ name: "John" }), { name: { $between: ["A", "K"] } })).toBe(true);
    expect(matches(row({ name: "Zoe" }), { name: { $between: ["A", "K"] } })).toBe(false);
  });

  test("bigints order natively", () => {
    expect(matches(row({ big: 10n }), { big: { $gt: 5n } })).toBe(true);
    expect(matches(row({ big: 10n }), { big: { $lte: 10n } })).toBe(true);
    expect(matches(row({ big: 10n }), { big: { $between: [1n, 9n] } })).toBe(false);
  });

  test("an unorderable value type still throws", () => {
    expect(() => matches(row(), { active: { $gt: false as any } })).toThrow(/\$gt/);
  });

  test("the TYPE narrows the accepted set — a boolean field rejects $gt", () => {
    // @ts-expect-error `$gt` is `T & (number | bigint | string | Date)`
    const condition: Condition<Row> = { active: { $gt: true } };
    expect(condition).toBeDefined();
  });
});

describe("R10/R11 — $has is plain containment", () => {
  test("$has accepts a scalar against an array column", () => {
    expect(matches(row({ tags: ["alpha", "beta"] }), { tags: { $has: "alpha" } })).toBe(
      true,
    );
    expect(matches(row({ tags: ["alpha", "beta"] }), { tags: { $has: "gamma" } })).toBe(
      false,
    );
  });

  test("$has partially matches an object column", () => {
    expect(matches(row(), { payload: { $has: { city: "Oslo" } } })).toBe(true);
    expect(matches(row(), { payload: { $has: { city: "Bergen" } } })).toBe(false);
  });

  test("$has matches an object against array elements", () => {
    const rec = { items: [{ sku: "a", qty: 1 }] };
    expect(matches(rec, { items: { $has: { sku: "a" } } })).toBe(true);
  });

  test("$has with an array operand requires every element to be contained", () => {
    expect(matches(row({ tags: ["alpha", "beta"] }), { tags: { $has: ["alpha"] } })).toBe(
      true,
    );
    expect(
      matches(row({ tags: ["alpha"] }), { tags: { $has: ["alpha", "gamma"] } as any }),
    ).toBe(false);
  });

  test("nested OPERATORS inside $has are no longer part of the language", () => {
    expect(matches(row(), { payload: { $has: { city: { $like: "O%" } } as any } })).toBe(
      false,
    );
  });

  test("$has over a null column does not match and does not crash", () => {
    expect(matches(row({ address: null }), { address: { $has: { city: "Oslo" } } })).toBe(
      false,
    );
  });
});

describe("R20 — empty things throw, but a root {} does not", () => {
  test("a root {} means no constraints", () => {
    expect(matches(row(), {})).toBe(true);
  });

  test("$and: [] throws", () => {
    expect(() => matches(row(), { $and: [] })).toThrow(/\$and/);
  });

  test("$or: [] throws", () => {
    expect(() => matches(row(), { $or: [] })).toThrow(/\$or/);
  });

  test("a NAMED FIELD's empty operator bag throws", () => {
    expect(() => matches(row(), { name: {} as any })).toThrow(/name/);
  });

  test("a nested empty operator bag throws", () => {
    expect(() => matches(row(), { address: { city: {} } as any })).toThrow(/city/);
  });

  test("a field-level empty $and / $or throws", () => {
    expect(() => matches(row(), { age: { $and: [] } })).toThrow(/\$and/);
    expect(() => matches(row(), { age: { $or: [] } })).toThrow(/\$or/);
  });
});

describe("M-5 — a nested condition over a NULL column does not crash", () => {
  test("a logical operator over a null object column returns false", () => {
    expect(
      matches(row({ address: null }), { address: { $or: [{ city: "Oslo" }] } }),
    ).toBe(false);
  });

  test("an $and over a null object column returns false", () => {
    expect(
      matches(row({ address: null }), { address: { $and: [{ city: "Oslo" }] } }),
    ).toBe(false);
  });

  test("a bare nested object over a null column returns false", () => {
    expect(matches(row({ address: null }), { address: { city: "Oslo" } })).toBe(false);
  });
});

describe("M-7 — a condition operator at the ROOT throws", () => {
  test("$eq at the root throws instead of silently matching nothing", () => {
    expect(() => matches(row(), { $eq: "John" } as any)).toThrow(/\$eq/);
  });

  test("$gt at the root throws", () => {
    expect(() => matches(row(), { $gt: 5 } as any)).toThrow(/\$gt/);
  });

  test("an unknown $-prefixed key at the root throws", () => {
    expect(() => matches(row(), { $nope: 1 } as any)).toThrow(/\$nope/);
  });
});
