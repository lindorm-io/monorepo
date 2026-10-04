import { describe, expect, test } from "vitest";
import { assertClaims } from "./assert-claims.js";
import { claimsMatch } from "./claims-match.js";

// The claim check, end to end: the root operators reach `@lindorm/match`, whose
// answer is the verdict. Where the matcher refuses the shape (an empty `$and` /
// `$or`, a `$not` that is not an object), its own `TypeError` is what a caller
// sees — the boundary is the matcher's, and these pin which side of it each
// shape falls on.
describe("claimsMatch / assertClaims root operators", () => {
  const claims = { subject: "user-1", clientId: "client-1" };

  test("$and over two claims answers true when both hold", () => {
    expect(
      claimsMatch(claims, { $and: [{ subject: "user-1" }, { clientId: "client-1" }] }),
    ).toBe(true);
  });

  test("$and is refused under its own key when one member fails", () => {
    const assert = { $and: [{ subject: "user-1" }, { clientId: "other" }] };

    expect(claimsMatch(claims, assert)).toBe(false);
    expect(() => assertClaims(claims, assert)).toThrow(
      expect.objectContaining({ code: "claims_invalid", data: { invalid: ["$and"] } }),
    );
  });

  test("$or answers true on its second member", () => {
    expect(
      claimsMatch(claims, { $or: [{ subject: "other" }, { subject: "user-1" }] }),
    ).toBe(true);
  });

  test("$not is refused under its own key when its payload matches", () => {
    const assert = { $not: { subject: "user-1" } };

    expect(claimsMatch(claims, assert)).toBe(false);
    expect(() => assertClaims(claims, assert)).toThrow(
      expect.objectContaining({ code: "claims_invalid", data: { invalid: ["$not"] } }),
    );
  });

  test("$not answers true when its payload does not match", () => {
    expect(claimsMatch(claims, { $not: { subject: "other" } })).toBe(true);
  });

  test("an empty $or is the matcher's TypeError on both forms", () => {
    const assert = { $or: [] };
    const message =
      "Operator $or requires at least one member — omit the key to place no constraint";

    expect(() => claimsMatch(claims, assert)).toThrow(new TypeError(message));
    expect(() => assertClaims(claims, assert)).toThrow(new TypeError(message));
  });

  test("an undefined $or member reaches the matcher at the claim check", () => {
    const assert = { $or: [undefined, { subject: "user-1" }] } as never;
    const message = "Cannot convert undefined or null to object";

    expect(() => claimsMatch(claims, assert)).toThrow(new TypeError(message));
    expect(() => assertClaims(claims, assert)).toThrow(new TypeError(message));
  });

  test("an empty $and is the matcher's TypeError on both forms", () => {
    const assert = { $and: [] };
    const message =
      "Operator $and requires at least one member — omit the key to place no constraint";

    expect(() => claimsMatch(claims, assert)).toThrow(new TypeError(message));
    expect(() => assertClaims(claims, assert)).toThrow(new TypeError(message));
  });

  test("a $not that is not an object is the matcher's TypeError on both forms", () => {
    const assert = { $not: "x" } as never;
    const message = "Operator $not requires an object payload";

    expect(() => claimsMatch(claims, assert)).toThrow(new TypeError(message));
    expect(() => assertClaims(claims, assert)).toThrow(new TypeError(message));
  });

  test("an empty $not rejects every claim set, named under its own key", () => {
    const assert = { $not: {} };

    expect(claimsMatch(claims, assert)).toBe(false);
    expect(() => assertClaims(claims, assert)).toThrow(
      expect.objectContaining({ code: "claims_invalid", data: { invalid: ["$not"] } }),
    );
  });
});
