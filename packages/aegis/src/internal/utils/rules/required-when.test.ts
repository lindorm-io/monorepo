import type { Dict } from "@lindorm/types";
import { describe, expect, test, vi } from "vitest";
import type { SignContext } from "../../../types/index.js";
import { requiredWhen } from "./required-when.js";

// The context is a CLOSED record, so this predicate cannot read a key that does
// not exist — `context.accessTokenIssud` would not compile.
const rule = {
  claim: "accessTokenHash",
  when: (_claims: Dict, context: SignContext) => context.accessTokenIssued === true,
};

describe("requiredWhen", () => {
  test("no entry when the predicate is false", () => {
    expect(requiredWhen({}, { accessTokenIssued: false }, rule)).toEqual([]);
  });

  test("no entry when the claim is already present", () => {
    expect(
      requiredWhen({ accessTokenHash: "h" }, { accessTokenIssued: true }, rule),
    ).toEqual([]);
  });

  /**
   * The SHORT-CIRCUIT itself, not merely its outcome. A satisfied claim ends the
   * rule before `when` is consulted, so an author's predicate is only ever
   * called on an EMPTY value — which makes
   * `when: (claims) => isClaimSatisfied(claims.x)` a rule that can never fire,
   * silently, since `false` is indistinguishable from a condition that did not
   * hold. That is documented as a public trap on `PolicyRule`, so it is pinned
   * on the mechanism: asserting only the empty result would still pass if the
   * predicate ran and happened to return `false`.
   */
  test("does not consult the predicate when the claim is already satisfied", () => {
    const when = vi.fn(() => true);

    expect(
      requiredWhen(
        { accessTokenHash: "h" },
        { accessTokenIssued: true },
        {
          claim: "accessTokenHash",
          when,
        },
      ),
    ).toEqual([]);
    expect(when).toHaveBeenCalledTimes(0);
  });

  test("consults the predicate when the claim is empty", () => {
    const when = vi.fn(() => false);

    expect(
      requiredWhen(
        { accessTokenHash: "" },
        { accessTokenIssued: true },
        {
          claim: "accessTokenHash",
          when,
        },
      ),
    ).toEqual([]);
    expect(when).toHaveBeenCalledTimes(1);
  });

  test("entry when the predicate is true and the claim is missing", () => {
    expect(requiredWhen({}, { accessTokenIssued: true }, rule)).toMatchSnapshot();
  });

  // An empty-string hash is not a hash; it must count as missing, or a caller
  // could satisfy the requirement by carrying nothing under the right name.
  test("entry when the claim is present but empty", () => {
    expect(
      requiredWhen({ accessTokenHash: "" }, { accessTokenIssued: true }, rule),
    ).toMatchSnapshot();
  });

  /**
   * The CONTAINER-empty half, which no built-in profile reaches: `requiredWhen`
   * names a claim, and the only built-in conditional demand is `id_token`'s
   * `at_hash` (a b64url string). Every conditional demand for an array- or
   * object-valued claim is therefore a CONSUMER-registered profile — the surface
   * this predicate was widened for — so it is covered here or nowhere.
   */
  test.each([
    ["empty array", []],
    ["empty object", {}],
  ])("entry when the claim is an %s", (_label, value) => {
    const containerRule = {
      claim: "confirmation",
      when: (_claims: Dict, context: SignContext) => context.accessTokenIssued === true,
    };

    expect(
      requiredWhen({ confirmation: value }, { accessTokenIssued: true }, containerRule),
    ).toMatchSnapshot();
  });
});
