import { describe, expect, test } from "vitest";
import { isClaimOmitted } from "../utils/rules/is-claim-omitted.js";
import { isClaimSatisfied } from "../utils/rules/is-claim-satisfied.js";
import { isNotStated } from "./is-not-stated.js";

/**
 * ⚠ THE PREDICATE IS TWO LINES, SO A TEST THAT ONLY RESTATED IT WOULD BE WORTH
 * NOTHING. What is pinned here is the thing that is NOT obvious from reading it:
 * where it sits between the two presence notions the rule layer already has.
 * `internal/utils/rules/index.ts` names all four in one table, and the claim that
 * table makes — that none of them is another — is what these rows check.
 *
 * The behaviour is exercised end to end by the walkers that ask it
 * (`translate.test.ts`, `classes/address-claim-wire.test.ts`, the scenario table);
 * this file exists so the BOUNDARY has somewhere to be stated once.
 */
describe("isNotStated — the codec's absence boundary", () => {
  test("both spellings of absence are unstated, and nothing else is", () => {
    expect(isNotStated(undefined)).toBe(true);
    expect(isNotStated(null)).toBe(true);

    for (const value of ["", "a", 0, 1, false, true, [], {}, new Date(0)]) {
      expect({ value, stated: isNotStated(value) }).toEqual({ value, stated: false });
    }
  });

  test("it is STRICTER than isClaimOmitted, on exactly one value", () => {
    // `isClaimOmitted` is `=== undefined` — a written `null` is present to it,
    // which is right for `forbidden` (a ceiling on the issuer's VOCABULARY) and
    // wrong for a codec deciding whether anything was stated.
    expect(isClaimOmitted(null)).toBe(false);
    expect(isNotStated(null)).toBe(true);
  });

  test("it is LOOSER than isClaimSatisfied, on the empty containers", () => {
    // `isClaimSatisfied` is `!isEmpty` — `""`, `[]` and `{}` are absent to it,
    // which is right for `required` and wrong here: an empty string is a value a
    // text member may hold, and whether it rides is the registry's `whenEmpty`
    // question, not this one.
    for (const value of ["", [], {}] as const) {
      expect({ value, satisfied: isClaimSatisfied(value), stated: !isNotStated(value) }) //
        .toEqual({ value, satisfied: false, stated: true });
    }
  });
});
