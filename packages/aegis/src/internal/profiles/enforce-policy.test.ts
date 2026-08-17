import type { Dict } from "@lindorm/types";
import { describe, expect, test } from "vitest";
import { AegisDomainError } from "../../errors/index.js";
import type { PolicyRule, TokenProfile } from "../../types/index.js";
import { externalAccessTokenProfile } from "./definitions/external-access-token.js";
import { enforcePolicy } from "./enforce-policy.js";
import { BUILT_IN_PROFILES } from "./registry.js";

/**
 * Every built-in profile that names `audience` in a PRESENCE rule — DERIVED from
 * the registry's own list, never restated.
 *
 * A hand-written version of this held seven of the ten and the three it dropped
 * were exactly the ones nothing else covered, which is the failure mode: an
 * exhaustiveness claim in a comment is not checked by anything, so it decays
 * silently as profiles are added.
 */
const namesAudience = (rule: PolicyRule): boolean => {
  // All THREE demand-side rules, not the two obvious ones: `requiredWhen` reads
  // the same notion and carries a single `claim`, so a future
  // `{ rule: "requiredWhen", claim: "audience" }` would otherwise drop out of
  // this filter silently and gain no row.
  if (rule.rule === "required") return rule.claims.includes("audience");
  if (rule.rule === "atLeastOneOf") return rule.claims.includes("audience");
  if (rule.rule === "requiredWhen") return rule.claim === "audience";

  return false;
};

const AUDIENCE_REQUIRING = BUILT_IN_PROFILES.filter((profile) =>
  profile.policy.some(namesAudience),
);

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

    /**
     * ⚠ A GATE THAT FAILED OPEN. Read with `in`, a `needs` key spelled like an
     * `Object.prototype` member resolved through the chain and was judged SUPPLIED
     * by every context, including `{}` — so the refusal never fired and
     * `requiredWhen` evaluated the author's predicate against a context that does
     * not hold the fact, which is the exact silence this rule exists to break.
     *
     * ⚠ The RUNTIME BACKSTOP for a type-level guarantee, the same shape
     * `buildCoseHeaders`'s reserved check has. `BoundRule.needs` is
     * `ReadonlyArray<ContextKey>` = `keyof SignContext`, so a TYPED profile cannot
     * spell one of these — hence the `as never` below, which states that the input
     * is off-contract on purpose. A profile is CALLER-REGISTERED
     * (`Aegis.registerProfile`), and an untyped registration — a JSON body, a JS
     * consumer, an `as any` — walks straight past the compiler.
     */
    test.each(["constructor", "toString", "valueOf", "hasOwnProperty"])(
      "refuses a mint whose context omits the prototype-named key %s",
      (key) => {
        const prototypeNeeds: ReadonlyArray<PolicyRule> = [
          {
            rule: "requiredWhen",
            on: ["mint"],
            needs: [key] as never,
            claim: "accessTokenHash",
            when: (_claims, context) => (context as Dict)[key] === true,
          },
        ];

        expect(() => run(prototypeNeeds, { subject: "u" }, "mint", {})).toThrow(
          expect.objectContaining({
            code: "missing_sign_context",
            data: expect.objectContaining({ missing: [key] }),
          }),
        );
      },
    );

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

  /**
   * The BUILT-IN profiles, resolved from a real registry rather than assembled
   * here — a synthetic policy proves the enforcer reads a rule, not that the
   * profiles shipped to consumers declare one that holds.
   */
  describe("built-in profiles", () => {
    /**
     * A superset satisfying every built-in `required` list at once, so a thrown
     * `invalid` list names only the claim a test deliberately emptied.
     *
     * ⚠ Not usable as-is for every profile: `security_event` FORBIDS `subject`
     * and `expiresAt` while requiring `subjectId`. {@link bagFor} removes each
     * profile's forbidden claims, which is why the superset can name them.
     */
    const COMPLETE: Dict = {
      audience: ["https://api.lindorm.test"],
      clientId: "client_1",
      events: { "urn:lindorm:event:sample": {} },
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
      issuer: "https://lindorm.test",
      sessionId: "sess_1",
      subject: "sub_1",
      subjectId: { format: "opaque", id: "sub_1" },
      token_introspection: { active: true },
      tokenId: "tok_1",
    };

    // The superset minus whatever THIS profile forbids — derived from its own
    // policy, so a profile's demands and its prohibitions cannot be satisfied by
    // a bag hand-tuned to one of them.
    const bagFor = (profile: TokenProfile): Dict => {
      const forbidden = new Set(
        profile.policy.flatMap((rule) => (rule.rule === "forbidden" ? rule.claims : [])),
      );
      const claims: Dict = {};

      for (const [key, value] of Object.entries(COMPLETE)) {
        if (forbidden.has(key as never)) continue;

        claims[key] = value;
      }

      return claims;
    };

    const enforce = (profile: TokenProfile, claims: Dict): void =>
      enforcePolicy({
        claims,
        context: { accessTokenIssued: false },
        direction: "verify",
        format: "jwt",
        profile,
      });

    // Without this the refusal tests below prove nothing: a bag that fails a
    // profile for unrelated reasons throws whatever the audience rule does.
    test.each(AUDIENCE_REQUIRING)("$name accepts a complete bag", (profile) => {
      expect(() => enforce(profile, bagFor(profile))).not.toThrow();
    });

    /**
     * `aud: []` addresses nobody, so it cannot satisfy a demand for an audience.
     *
     * ⚠ `access_token` IS in this set. It was also the one profile the old
     * single predicate could not fail open on — but only because
     * `AUD_SINGLE_RESOURCE` (`$length: 1`, `definitions/rule-predicates.ts`)
     * rejected the empty list as a CARDINALITY violation, which is a different
     * rule answering a different question. Relax that profile to multiple
     * audiences and the presence rule asserted here is the only defence left.
     */
    test.each(AUDIENCE_REQUIRING)("$name refuses an empty audience", (profile) => {
      expect(() => enforce(profile, { ...bagFor(profile), audience: [] })).toThrow(
        expect.objectContaining({
          code: "profile_policy_invalid",
          data: expect.objectContaining({
            invalid: expect.arrayContaining([
              { key: "audience", message: 'Required claim "audience" is missing' },
            ]),
          }),
        }),
      );
    });

    // The derivation is only as good as its reach. Ten built-ins name `audience`
    // in a presence rule; pinning the COUNT is what makes a future profile that
    // silently drops out of the filter visible.
    test("every built-in naming audience in a presence rule is covered", () => {
      expect(AUDIENCE_REQUIRING.map((profile) => profile.name).sort()).toMatchSnapshot();
    });

    /**
     * `external_access_token` has `typ: { presence: "none" }`, so its `forbidden`
     * list is the whole of what keeps an id_token out — there is no structural
     * discriminator behind it. `forbidden` therefore reads presence as
     * VOCABULARY: an issuer that named `at_hash` stated an access-token hash,
     * and the registry's `whenEmpty: "keep"` cell means the empty form is not
     * swept up on the way to the wire either.
     */
    test("external_access_token refuses a named-but-empty access token hash", () => {
      const profile = externalAccessTokenProfile;

      expect(() => enforce(profile, { ...bagFor(profile), accessTokenHash: "" })).toThrow(
        expect.objectContaining({
          code: "profile_policy_invalid",
          data: expect.objectContaining({
            invalid: expect.arrayContaining([
              {
                key: "accessTokenHash",
                message: 'Forbidden claim "accessTokenHash" is present',
              },
            ]),
          }),
        }),
      );
    });
  });
});
