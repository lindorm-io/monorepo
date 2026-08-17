import { describe, expect, test } from "vitest";
import { isClaimOmitted } from "./is-claim-omitted.js";

describe("isClaimOmitted", () => {
  test("only undefined counts as unnamed", () => {
    expect(isClaimOmitted(undefined)).toBe(true);
  });

  // The vocabulary notion is NOT the demand notion: naming a claim with an empty
  // value still names it. This is the whole reason the two are separate
  // predicates rather than one consumed at both polarities.
  test.each([
    ["null", null],
    ["empty string", ""],
    ["empty array", []],
    ["empty object", {}],
  ])("%s names the claim", (_label, value) => {
    expect(isClaimOmitted(value)).toBe(false);
  });

  test("a stated value names the claim", () => {
    expect(isClaimOmitted("n_1")).toBe(false);
    expect(isClaimOmitted(0)).toBe(false);
    expect(isClaimOmitted(false)).toBe(false);
  });
});
