import type { Dict } from "@lindorm/types";
import { describe, expect, test } from "vitest";
import { AegisDomainError } from "../../errors/index.js";
import type { PolicyRule, TokenProfile } from "../../types/index.js";
import { externalAccessTokenProfile } from "./definitions/external-access-token.js";
import { idTokenProfile } from "./definitions/id-token.js";
import { enforcePolicy } from "./enforce-policy.js";
import { BUILT_IN_PROFILES } from "./registry.js";

/**
 * Every built-in profile that names `audience` in a PRESENCE rule — DERIVED from
 * the registry's own list, never restated. ⚠ A hand-written version decays
 * silently as profiles are added, because nothing checks an exhaustiveness claim
 * made in a comment.
 */
const namesAudience = (rule: PolicyRule): boolean => {
  // ⚠ All THREE demand-side rules: `requiredWhen` reads the same notion and carries
  // a single `claim`, so a `{ rule: "requiredWhen", claim: "audience" }` would
  // otherwise drop out of this filter silently and gain no row.
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
  unreadable: ReadonlySet<string> = new Set(),
): void =>
  enforcePolicy({
    claims,
    context,
    direction,
    format: "jwt",
    profile: profileWith(policy),
    unreadable,
  });

describe("enforcePolicy", () => {
  // The mint writer leaves off the wire a value its reader would not read back;
  // a demand rule refuses it there rather than minting the token without it.
  describe("the unreadable set", () => {
    const invalidOf = (fn: () => void): unknown => {
      try {
        fn();
      } catch (error) {
        return (error as AegisDomainError).data.invalid;
      }

      throw new Error("expected the enforcer to refuse");
    };

    test("required reports an unreadable claim on mint", () => {
      const policy: ReadonlyArray<PolicyRule> = [
        { rule: "required", on: ["mint"], claims: ["subject"] },
      ];

      expect(
        invalidOf(() => run(policy, { subject: 42 }, "mint", {}, new Set(["subject"]))),
      ).toEqual([
        {
          key: "subject",
          message: 'Required claim "subject" is not of its declared type',
        },
      ]);
    });

    test("atLeastOneOf and requiredWhen do not count an unreadable claim", () => {
      const policy: ReadonlyArray<PolicyRule> = [
        { rule: "atLeastOneOf", on: ["mint"], claims: ["subject", "sessionId"] },
        {
          rule: "requiredWhen",
          on: ["mint"],
          needs: ["accessTokenIssued"],
          claim: "accessTokenHash",
          when: (_claims, context) => context.accessTokenIssued === true,
        },
      ];

      expect(
        invalidOf(() =>
          run(
            policy,
            { subject: 42, accessTokenHash: 42 },
            "mint",
            { accessTokenIssued: true },
            new Set(["subject", "accessTokenHash"]),
          ),
        ),
      ).toEqual([
        {
          key: "subject|sessionId",
          message: "At least one of [subject, sessionId] is required",
        },
        {
          key: "accessTokenHash",
          message:
            'Conditionally required claim "accessTokenHash" is not of its declared type',
        },
      ]);
    });

    test("match and shape read the domain value, not the unreadable set", () => {
      const policy: ReadonlyArray<PolicyRule> = [
        // The cast reaches the class a well-typed condition cannot: the value the
        // writer would leave off the wire is exactly what `match` must still see.
        {
          rule: "match",
          on: ["mint"],
          condition: { subject: { $eq: 42 as unknown as string } },
        },
        { rule: "shape", on: ["mint"], shape: "subjectId" },
      ];
      const unreadable = new Set(["subject", "subjectId"]);

      expect(() =>
        run(
          policy,
          { subject: 42, subjectId: { format: "email", email: "a@b" } },
          "mint",
          {},
          unreadable,
        ),
      ).not.toThrow();
      expect(
        invalidOf(() =>
          run(policy, { subject: 42, subjectId: "x" }, "mint", {}, unreadable),
        ),
      ).toEqual([{ key: "subjectId", message: "subjectId must be an object" }]);
    });

    test("forbidden reads the vocabulary, so an unreadable claim is still present", () => {
      const policy: ReadonlyArray<PolicyRule> = [
        { rule: "forbidden", on: ["mint"], claims: ["nonce"] },
      ];

      expect(
        invalidOf(() => run(policy, { nonce: 42 }, "mint", {}, new Set(["nonce"]))),
      ).toEqual([{ key: "nonce", message: 'Forbidden claim "nonce" is present' }]);
    });

    test("a key in the set that no demand rule names produces no entry", () => {
      const policy: ReadonlyArray<PolicyRule> = [
        { rule: "required", on: ["mint"], claims: ["subject"] },
        { rule: "atLeastOneOf", on: ["mint"], claims: ["subject", "sessionId"] },
        {
          rule: "requiredWhen",
          on: ["mint"],
          needs: ["accessTokenIssued"],
          claim: "accessTokenHash",
          when: () => true,
        },
      ];

      expect(() =>
        run(
          policy,
          { subject: "u", accessTokenHash: "h", region: 42 },
          "mint",
          { accessTokenIssued: true },
          new Set(["region"]),
        ),
      ).not.toThrow();
    });
  });

  // WHICH rules run is decided by the rule, not by the caller: the same call with a
  // different direction runs a different subset, and nothing else changes.
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

  // A context-reading rule not given its context does not FAIL — it silently does
  // not fire, which is indistinguishable from the fact being false. Refusing the
  // mint is the only answer that tells the two apart.
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
     * ⚠ A GATE THAT FAILS OPEN UNDER `in`: a `needs` key spelled like an
     * `Object.prototype` member resolves through the chain and reads as SUPPLIED by
     * every context, including `{}`, so `requiredWhen` evaluates the author's
     * predicate against a context that does not hold the fact.
     *
     * ⚠ The RUNTIME BACKSTOP for a type-level guarantee, the same shape
     * `buildCoseHeaders`'s reserved check has. `BoundRule.needs` is
     * `ReadonlyArray<ContextKey>`, so a TYPED profile cannot spell one of these —
     * hence the `as never` below. A profile is CALLER-REGISTERED
     * (`Aegis.registerProfile`), and an untyped registration walks past the compiler.
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

  // One bad token reports every reason it is bad — a throw per category would let
  // the first one reached hide the rest.
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
   * The BUILT-IN profiles, resolved from a real registry rather than assembled here:
   * a synthetic policy proves the enforcer reads a rule, not that the profiles
   * shipped to consumers declare one.
   */
  describe("built-in profiles", () => {
    /**
     * A superset satisfying every built-in `required` list at once, so a thrown
     * `invalid` list names only the claim a test deliberately emptied.
     *
     * ⚠ Not usable as-is for every profile — some FORBID what others require.
     * {@link bagFor} removes each profile's forbidden claims.
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

    // The superset minus whatever THIS profile forbids, derived from its own policy
    // — a bag hand-tuned to one profile could satisfy its demands and not its
    // prohibitions.
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
        unreadable: new Set(),
      });

    // Without this the refusal tests below prove nothing: a bag that fails a
    // profile for unrelated reasons throws whatever the audience rule does.
    test.each(AUDIENCE_REQUIRING)("$name accepts a complete bag", (profile) => {
      expect(() => enforce(profile, bagFor(profile))).not.toThrow();
    });

    /**
     * `aud: []` addresses nobody, so it cannot satisfy a demand for an audience.
     *
     * ⚠ `access_token` IS in this set, and `AUD_SINGLE_RESOURCE` (`$length: 1`,
     * `definitions/rule-predicates.ts`) is NOT what covers it: that rejects the
     * empty list as a CARDINALITY violation, a different question. Relax the profile
     * to multiple audiences and the presence rule asserted here is the only defence.
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

    // The derivation is only as good as its reach: pinning the COUNT is what makes a
    // profile silently dropping out of the filter visible.
    test("every built-in naming audience in a presence rule is covered", () => {
      expect(AUDIENCE_REQUIRING.map((profile) => profile.name).sort()).toMatchSnapshot();
    });

    /**
     * `external_access_token` has `typ: { presence: "none" }`, so its `forbidden`
     * list is the whole of what keeps an id_token out. `forbidden` therefore reads
     * presence as VOCABULARY: an issuer that named `at_hash` stated an access-token
     * hash, and the registry's `whenEmpty: "keep"` cell means the empty form is not
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

    describe("id_token with no access token co-issued", () => {
      const mint = (claims: Dict): void =>
        enforcePolicy({
          claims,
          context: { accessTokenIssued: false },
          direction: "mint",
          format: "jwt",
          profile: idTokenProfile,
          unreadable: new Set(),
        });

      test.each([
        ["empty", ""],
        ["null", null],
      ])(
        "id_token refuses a named-but-%s access token hash even when no access token co-issued",
        (_label, accessTokenHash) => {
          expect(() => mint({ ...bagFor(idTokenProfile), accessTokenHash })).toThrow(
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
        },
      );

      test("id_token owes no access token hash when none is named and no access token co-issued", () => {
        expect(() => mint(bagFor(idTokenProfile))).not.toThrow();
      });
    });
  });
});
