import { describe, expect, test } from "vitest";
import { AegisDomainError } from "../../errors/index.js";
import type { PolicyRule, TokenProfile } from "../../types/index.js";
import { enforcePolicy } from "./enforce-policy.js";

const profileWith = (policy: ReadonlyArray<PolicyRule>): TokenProfile => ({
  name: "test_profile",
  use: "both",
  typ: { presence: "none" },
  policy,
  autoInject: [],
  issuer: "per-token",
  lifetime: null,
  encryptable: false,
});

const run = (
  policy: ReadonlyArray<PolicyRule>,
  claims: Record<string, unknown>,
  direction: "mint" | "verify",
  context = {},
): void =>
  enforcePolicy({
    claims,
    context,
    direction,
    format: "jwt",
    profile: profileWith(policy),
  });

describe("enforcePolicy", () => {
  // The whole reason the list exists: WHICH rules run is decided by the rule,
  // not by the caller. The same call with a different direction runs a different
  // subset, and nothing else about the call changes.
  describe("direction selection", () => {
    const policy: ReadonlyArray<PolicyRule> = [
      { rule: "required", on: ["mint"], claims: ["subject"] },
      { rule: "required", on: ["verify"], claims: ["tokenId"] },
    ];

    test("runs only the rules naming mint", () => {
      expect(() => run(policy, { subject: "u" }, "mint")).not.toThrow();
      expect(() => run(policy, { tokenId: "t" }, "mint")).toThrow(AegisDomainError);
    });

    test("runs only the rules naming verify", () => {
      expect(() => run(policy, { tokenId: "t" }, "verify")).not.toThrow();
      expect(() => run(policy, { subject: "u" }, "verify")).toThrow(AegisDomainError);
    });

    test("runs a two-direction rule in both", () => {
      const both: ReadonlyArray<PolicyRule> = [
        { rule: "required", on: ["mint", "verify"], claims: ["subject"] },
      ];

      expect(() => run(both, {}, "mint")).toThrow(AegisDomainError);
      expect(() => run(both, {}, "verify")).toThrow(AegisDomainError);
    });
  });

  describe("rule kinds", () => {
    test("required names every missing claim", () => {
      expect(() =>
        run(
          [{ rule: "required", on: ["mint"], claims: ["subject", "issuer", "tokenId"] }],
          { subject: "u" },
          "mint",
        ),
      ).toThrow(
        expect.objectContaining({
          code: "profile_policy_invalid",
          data: expect.objectContaining({
            direction: "mint",
            format: "jwt",
            invalid: [
              { key: "issuer", message: 'Required claim "issuer" is missing' },
              { key: "tokenId", message: 'Required claim "tokenId" is missing' },
            ],
          }),
        }),
      );
    });

    test("forbidden names every present claim", () => {
      expect(() =>
        run(
          [{ rule: "forbidden", on: ["verify"], claims: ["nonce"] }],
          { nonce: "n" },
          "verify",
        ),
      ).toThrow(AegisDomainError);
    });

    test("atLeastOneOf is satisfied by any one member", () => {
      const policy: ReadonlyArray<PolicyRule> = [
        {
          rule: "atLeastOneOf",
          on: ["mint", "verify"],
          claims: ["subject", "sessionId"],
        },
      ];

      expect(() => run(policy, { sessionId: "s" }, "verify")).not.toThrow();
      expect(() => run(policy, {}, "verify")).toThrow(AegisDomainError);
    });

    test("match evaluates the condition over the domain claims", () => {
      const policy: ReadonlyArray<PolicyRule> = [
        { rule: "match", on: ["mint"], condition: { subject: { $eq: "u" } } },
      ];

      expect(() => run(policy, { subject: "u" }, "mint")).not.toThrow();
      expect(() => run(policy, { subject: "other" }, "mint")).toThrow(AegisDomainError);
    });

    test("shape resolves the named structural validator", () => {
      const policy: ReadonlyArray<PolicyRule> = [
        { rule: "shape", on: ["verify"], shape: "events" },
      ];

      expect(() => run(policy, { events: { "urn:x:e": {} } }, "verify")).not.toThrow();
      expect(() => run(policy, { events: "not-an-object" }, "verify")).toThrow(
        AegisDomainError,
      );
    });
  });

  // A context-reading rule that is not given its context does not FAIL — it
  // silently does not fire, which is indistinguishable from the fact being false.
  // Refusing the mint is the only answer that tells the two apart.
  describe("declared context", () => {
    const policy: ReadonlyArray<PolicyRule> = [
      {
        rule: "requiredWhen",
        on: ["mint"],
        needs: ["accessTokenIssued"],
        claim: "accessTokenHash",
        when: (_claims, context) => context.accessTokenIssued === true,
      },
    ];

    test("refuses a mint whose context omits a key the rule reads", () => {
      expect(() => run(policy, { subject: "u" }, "mint")).toThrow(
        expect.objectContaining({
          code: "missing_sign_context",
          data: expect.objectContaining({ missing: ["accessTokenIssued"] }),
        }),
      );
    });

    // The fact stated as FALSE is a supplied fact, and the rule does not fire.
    test("accepts the fact stated as false", () => {
      expect(() =>
        run(policy, { subject: "u" }, "mint", { accessTokenIssued: false }),
      ).not.toThrow();
    });

    test("enforces the claim when the fact is stated as true", () => {
      expect(() =>
        run(policy, { subject: "u" }, "mint", { accessTokenIssued: true }),
      ).toThrow(
        expect.objectContaining({
          code: "profile_policy_invalid",
          data: expect.objectContaining({
            invalid: [
              {
                key: "accessTokenHash",
                message: 'Conditionally required claim "accessTokenHash" is missing',
              },
            ],
          }),
        }),
      );
    });

    test("the context is never consulted at verify", () => {
      expect(() => run(policy, {}, "verify")).not.toThrow();
    });
  });

  // One bad token reports every reason it is bad. Each category used to throw
  // from its own block, so the first one reached hid the rest.
  test("collects failures across every rule before throwing", () => {
    expect(() =>
      run(
        [
          { rule: "required", on: ["mint"], claims: ["subject"] },
          { rule: "forbidden", on: ["mint"], claims: ["nonce"] },
        ],
        { nonce: "n" },
        "mint",
      ),
    ).toThrow(
      expect.objectContaining({
        data: expect.objectContaining({
          invalid: [
            { key: "subject", message: 'Required claim "subject" is missing' },
            { key: "nonce", message: 'Forbidden claim "nonce" is present' },
          ],
        }),
      }),
    );
  });

  test("an empty policy accepts anything", () => {
    expect(() => run([], {}, "mint")).not.toThrow();
    expect(() => run([], {}, "verify")).not.toThrow();
  });
});
