import { Matcher } from "@lindorm/match";
import { describe, expect, test } from "vitest";
import type { TokenDelegation } from "../../types/domain/delegation.js";
import { validateActor } from "./validate-actor.js";

const delegated: TokenDelegation = {
  currentActor: "service-1",
  actorChain: [{ subject: "service-1" }],
  isDelegated: true,
};

const direct: TokenDelegation = {
  currentActor: undefined,
  actorChain: [],
  isDelegated: false,
};

/**
 * The EMPTINESS boundary of `allowedActor`.
 *
 * ⚠ The undefined-valued half is stated here: a feature step's data is text, and
 * no text spells `{ subject: undefined }` apart from `{}`. The `{}` half IS
 * stated at the public door, by `Aegis.delegation.feature` "a verifier stating an
 * actor allowlist with no condition in it has the call refused rather than
 * obeyed".
 */
describe("validateActor — an allowedActor that constrains nothing", () => {
  test("refuses a condition naming no field", () => {
    expect(validateActor(delegated, { allowedActor: {} })).toEqual({
      code: "actor_policy_invalid",
      message: expect.stringMatching(/allowedActor/),
    });
  });

  // `Matcher.match` drops undefined-valued keys before requiring the rest, so
  // this condition matches every actor exactly as `{}` does.
  test("refuses a condition whose only key is undefined", () => {
    expect(validateActor(delegated, { allowedActor: { subject: undefined } })?.code).toBe(
      "actor_policy_invalid",
    );
  });

  test("refuses a condition whose every key is undefined", () => {
    expect(
      validateActor(delegated, {
        allowedActor: { subject: undefined, issuer: undefined },
      })?.code,
    ).toBe("actor_policy_invalid");
  });

  // The guard reads the condition's STRUCTURE, not its top-level keys: an
  // alternation admits an actor satisfying any one member, so one member naming
  // no field opens the whole list. The full boundary is in
  // `constrains-nothing.test.ts`.
  test("refuses an alternation offering a member that names no field", () => {
    expect(
      validateActor(delegated, {
        allowedActor: { $or: [{ subject: "nobody" }, {}] },
      })?.code,
    ).toBe("actor_policy_invalid");
  });

  // The other family `actor_policy_invalid` covers: the alternation offers a
  // member every actor satisfies, and its sibling is a named field with an empty
  // operator bag, which `Matcher` throws on rather than answering. Refusing the
  // CALL is the only outcome that names the caller's mistake.
  test("refuses an alternation whose sibling member the matcher cannot run", () => {
    const allowedActor = { $or: [{ subject: {} }, {}] };

    expect(validateActor(delegated, { allowedActor })?.code).toBe("actor_policy_invalid");
    expect(() => Matcher.match({ subject: "service-1" }, allowedActor)).toThrow(
      TypeError,
    );
  });

  test("applies a condition that names a field", () => {
    expect(
      validateActor(delegated, { allowedActor: { subject: "service-1" } }),
    ).toBeNull();
    expect(validateActor(delegated, { allowedActor: { subject: "rogue" } })).toEqual({
      code: "actor_not_allowed",
      message: "Actor not allowed",
      debug: { actor: { subject: "service-1" } },
    });
  });

  test("accepts an absent allowedActor as no actor policy", () => {
    expect(validateActor(direct, {})).toBeNull();
    expect(validateActor(direct, undefined)).toBeNull();
    expect(validateActor(direct, { allowedActor: undefined })).toBeNull();
  });

  // The refusal is about the POLICY, so a token that would fail some other actor
  // check must not answer in its place — otherwise the misconfiguration is
  // reported as a property of whichever token happened to arrive.
  test("reports the empty condition ahead of the token-shaped checks", () => {
    expect(validateActor(direct, { required: true, allowedActor: {} })?.code).toBe(
      "actor_policy_invalid",
    );
  });
});

/**
 * A token naming no actor is refused BEFORE the condition is consulted.
 * `Matcher` negates two-valuedly, so an actor that is not there matches every
 * condition stated as a denial — which is why both below are denial-shaped. A
 * flat equality bag is refused by the matcher itself, guard or no guard, so a row
 * built on one would pass with the guard deleted.
 */
describe("validateActor — an allowedActor against a token naming no actor", () => {
  test("refuses under a condition stated as a denial", () => {
    expect(
      validateActor(direct, { allowedActor: { $not: { subject: "rogue" } } }),
    ).toEqual({ code: "actor_not_allowed", message: "Actor not allowed" });
  });

  test("refuses under a condition stated as an absence check", () => {
    expect(
      validateActor(direct, { allowedActor: { subject: { $exists: false } } })?.code,
    ).toBe("actor_not_allowed");
  });
});
