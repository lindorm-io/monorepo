import { Aegis } from "../../classes/Aegis.js";
import type { AegisDomainError } from "../../errors/index.js";
import { createHash } from "./create-hash.js";
import { HASH_MATCHERS } from "./hash-matchers.js";
import { createIdentityMatchers } from "./jwt-identity-matchers.js";
import { createJwtValidate } from "./jwt-validate.js";
import { claimByDomain, coseName, joseName } from "../claims/claims-registry.js";
import { describe, expect, test } from "vitest";

// The claims the registry marks `value: "array"` AND the domain matcher surface
// names — a scalar matcher for one of these means "must CONTAIN this value".
const ARRAY_CLAIMS = [
  "audience",
  "scope",
  "authMethods",
  "roles",
  "permissions",
  "groups",
  "entitlements",
] as const;

describe("createJwtValidate", () => {
  describe("array-valued claims", () => {
    test.each(ARRAY_CLAIMS)("should lift a scalar %s to a single-element $all", (key) => {
      expect(createJwtValidate({ [key]: "value" })).toEqual({
        [key]: { $all: ["value"] },
      });
    });

    test.each(ARRAY_CLAIMS)("should keep an array %s as $all", (key) => {
      expect(createJwtValidate({ [key]: ["one", "two"] })).toEqual({
        [key]: { $all: ["one", "two"] },
      });
    });

    test.each(ARRAY_CLAIMS)("should pass an operator %s through verbatim", (key) => {
      expect(createJwtValidate({ [key]: { $in: ["one", "two"] } })).toEqual({
        [key]: { $in: ["one", "two"] },
      });
    });
  });

  describe("scalar claims", () => {
    test("should build $eq for an equality claim", () => {
      expect(createJwtValidate({ subject: "s" })).toEqual({ subject: { $eq: "s" } });
    });

    test("should build $eq for the issuer identity claim", () => {
      expect(createJwtValidate({ issuer: "https://tyr.test" })).toEqual({
        issuer: { $eq: "https://tyr.test" },
      });
    });

    test("should build $eq for a numeric claim", () => {
      expect(createJwtValidate({ levelOfAssurance: 3 })).toEqual({
        levelOfAssurance: { $eq: 3 },
      });
    });

    test("should build $eq for a key the registry does not know", () => {
      expect(createJwtValidate({ custom_claim: "x" } as never)).toEqual({
        custom_claim: { $eq: "x" },
      });
    });
  });

  // Hashing a raw source needs the token's signing algorithm, and `alg` is a
  // HEADER parameter — never a claim. This surface is handed a flat claim dict,
  // so it has nothing to resolve one from: the hash-DERIVE matchers belong to
  // verify alone (`DomainHashMatchers`), and this builder has neither a branch
  // nor an `algorithm` parameter for them.
  describe("hash claims", () => {
    // Nothing is lost in expressiveness: the digest claims are ordinary
    // equality claims, matched under their own domain name through the lift.
    test("should accept a pre-computed hash as a plain equality matcher", () => {
      expect(createJwtValidate({ accessTokenHash: "precomputed" })).toEqual({
        accessTokenHash: { $eq: "precomputed" },
      });
      expect(createJwtValidate({ codeHash: "precomputed" })).toEqual({
        codeHash: { $eq: "precomputed" },
      });
      expect(createJwtValidate({ stateHash: "precomputed" })).toEqual({
        stateHash: { $eq: "precomputed" },
      });
    });

    // `accessToken` is not a member of `DomainAssert`, so reaching this needs a
    // cast. Past the type it is simply an unmapped key, and gets exactly the
    // semantics any MISSPELLED claim name gets — a literal `$eq` under the key
    // as written, which no claim set carries. The type is the guard; a cast
    // past it buys typo behaviour, not a special case.
    test.each(["accessToken", "authCode", "authState"] as const)(
      "should treat a cast %s as an ordinary unmapped key",
      (key) => {
        expect(createJwtValidate({ [key]: "raw" } as never)).toEqual({
          [key]: { $eq: "raw" },
        });
      },
    );
  });

  describe("boolean and Date matchers", () => {
    test("should build $eq for a boolean claim", () => {
      expect(createJwtValidate({ emailVerified: true } as never)).toEqual({
        emailVerified: { $eq: true },
      });
    });

    test("should build $eq for a Date claim", () => {
      const authTime = new Date("2024-01-01T08:00:00.000Z");

      expect(createJwtValidate({ authTime })).toEqual({ authTime: { $eq: authTime } });
    });
  });

  test("should throw on an unsupported value shape", () => {
    expect(() => createJwtValidate({ subject: null } as never)).toThrowError(
      /Unsupported value/,
    );
  });

  // The root operators are `@lindorm/match`'s, and they nest: each member of
  // `$and` / `$or` and the payload of `$not` is a condition object of its own,
  // whose claim keys take the same value lift as the root's.
  describe("root operators", () => {
    test("should lift the claim keys inside every $and member", () => {
      expect(createJwtValidate({ $and: [{ subject: "s" }, { clientId: "c" }] })).toEqual({
        $and: [{ subject: { $eq: "s" } }, { clientId: { $eq: "c" } }],
      });
    });

    test("should lift the claim keys inside every $or member", () => {
      expect(createJwtValidate({ $or: [{ subject: "s" }, { subject: "t" }] })).toEqual({
        $or: [{ subject: { $eq: "s" } }, { subject: { $eq: "t" } }],
      });
    });

    test("should lift the claim keys inside a $not payload", () => {
      expect(createJwtValidate({ $not: { subject: "s" } })).toEqual({
        $not: { subject: { $eq: "s" } },
      });
    });

    test("should lift an array-valued claim inside a branch exactly as at the root", () => {
      expect(createJwtValidate({ $or: [{ scope: "openid" }] } as never)).toEqual({
        $or: [{ scope: { $all: ["openid"] } }],
      });
    });

    test("should recurse through operators nested in operators", () => {
      expect(
        createJwtValidate({
          $and: [
            { $or: [{ subject: "s" }, { $not: { subject: "t" } }] },
            { clientId: "c" },
          ],
        }),
      ).toEqual({
        $and: [
          { $or: [{ subject: { $eq: "s" } }, { $not: { subject: { $eq: "t" } } }] },
          { clientId: { $eq: "c" } },
        ],
      });
    });

    test("should refuse an unsupported value inside a branch under its own key", () => {
      expect(() => createJwtValidate({ $or: [{ subject: null }] } as never)).toThrowError(
        /Unsupported value: null for key: subject/,
      );
    });

    test("should skip an undefined value inside a branch", () => {
      expect(createJwtValidate({ $or: [{ subject: undefined, clientId: "c" }] })).toEqual(
        {
          $or: [{ clientId: { $eq: "c" } }],
        },
      );
    });
  });
});

// The static door, end to end: the root operators reach `@lindorm/match`, whose
// answer is the verdict. Where the matcher refuses the shape (an empty `$and` /
// `$or`, a `$not` that is not an object), its own `TypeError` is what a caller
// sees — the boundary is the matcher's, and these pin which side of it each
// shape falls on.
describe("Aegis.matches / Aegis.assert root operators", () => {
  const claims = { subject: "user-1", clientId: "client-1" };

  test("$and over two claims answers true when both hold", () => {
    expect(
      Aegis.matches(claims, { $and: [{ subject: "user-1" }, { clientId: "client-1" }] }),
    ).toBe(true);
  });

  test("$and is refused under its own key when one member fails", () => {
    const assert = { $and: [{ subject: "user-1" }, { clientId: "other" }] };

    expect(Aegis.matches(claims, assert)).toBe(false);
    expect(() => Aegis.assert(claims, assert)).toThrow(
      expect.objectContaining({ code: "claims_invalid", data: { invalid: ["$and"] } }),
    );
  });

  test("$or answers true on its second member", () => {
    expect(
      Aegis.matches(claims, { $or: [{ subject: "other" }, { subject: "user-1" }] }),
    ).toBe(true);
  });

  test("$not is refused under its own key when its payload matches", () => {
    const assert = { $not: { subject: "user-1" } };

    expect(Aegis.matches(claims, assert)).toBe(false);
    expect(() => Aegis.assert(claims, assert)).toThrow(
      expect.objectContaining({ code: "claims_invalid", data: { invalid: ["$not"] } }),
    );
  });

  test("$not answers true when its payload does not match", () => {
    expect(Aegis.matches(claims, { $not: { subject: "other" } })).toBe(true);
  });

  test("an empty $or is the matcher's TypeError on both forms", () => {
    const assert = { $or: [] };
    const message =
      "Operator $or requires at least one member — omit the key to place no constraint";

    expect(() => Aegis.matches(claims, assert)).toThrow(new TypeError(message));
    expect(() => Aegis.assert(claims, assert)).toThrow(new TypeError(message));
  });

  test("an undefined $or member reaches the matcher on the static door", () => {
    const assert = { $or: [undefined, { subject: "user-1" }] } as never;
    const message = "Cannot convert undefined or null to object";

    expect(() => Aegis.matches(claims, assert)).toThrow(new TypeError(message));
    expect(() => Aegis.assert(claims, assert)).toThrow(new TypeError(message));
  });

  test("an empty $and is the matcher's TypeError on both forms", () => {
    const assert = { $and: [] };
    const message =
      "Operator $and requires at least one member — omit the key to place no constraint";

    expect(() => Aegis.matches(claims, assert)).toThrow(new TypeError(message));
    expect(() => Aegis.assert(claims, assert)).toThrow(new TypeError(message));
  });

  test("a $not that is not an object is the matcher's TypeError on both forms", () => {
    const assert = { $not: "x" } as never;
    const message = "Operator $not requires an object payload";

    expect(() => Aegis.matches(claims, assert)).toThrow(new TypeError(message));
    expect(() => Aegis.assert(claims, assert)).toThrow(new TypeError(message));
  });

  test("an empty $not rejects every claim set, named under its own key", () => {
    const assert = { $not: {} };

    expect(Aegis.matches(claims, assert)).toBe(false);
    expect(() => Aegis.assert(claims, assert)).toThrow(
      expect.objectContaining({ code: "claims_invalid", data: { invalid: ["$not"] } }),
    );
  });
});

// The assert and verify halves share ONE value lift; only the KEY differs (assert
// keeps the caller's domain key, verify re-keys to the wire name). Pinning that
// is what keeps the two from drifting apart again.
describe("createJwtValidate / createIdentityMatchers parity", () => {
  const matchers = {
    audience: "https://tyr.test",
    issuer: "https://idp.test",
    subject: "user-1",
    scope: "openid",
    authMethods: ["pwd", "otp"],
    roles: { $in: ["admin", "editor"] },
    permissions: "read",
    groups: ["staff"],
    entitlements: "premium",
    levelOfAssurance: 3,
  };

  test("should produce the same condition for every matcher, keyed by wire name", () => {
    const assertPredicate = createJwtValidate(matchers as never);
    const verifyPredicate = createIdentityMatchers("ES256", matchers, joseName);

    for (const key of Object.keys(matchers)) {
      const spec = claimByDomain(key);
      const jose = (spec && joseName(spec)) as keyof typeof verifyPredicate;

      expect(jose).toBeDefined();
      expect(verifyPredicate[jose]).toEqual(
        assertPredicate[key as keyof typeof assertPredicate],
      );
    }
  });

  test("should build the verify predicate unchanged", () => {
    expect(createIdentityMatchers("ES256", matchers, joseName)).toMatchSnapshot();
  });

  test("should build the assert predicate", () => {
    expect(createJwtValidate(matchers as never)).toMatchSnapshot();
  });

  /**
   * ⛔ A CALLER-CHOSEN KEY IS DEFINED, NEVER ASSIGNED. `Aegis.assert` /
   * `Aegis.matches` match a flat dict the caller already holds, so the matcher
   * KEYS are the caller's own, and `__proto__` is an ordinary claim name in a
   * dict built from parsed JSON. `liftClaimMatcher` answers `{ $eq }` for it like
   * any other string, so a plain `predicate[key] = operator` hits
   * `Object.prototype`'s setter: the prototype is swapped, no own key is created,
   * and the caller's assertion is silently DROPPED — the strictest possible
   * failure direction for an assertion API.
   *
   * ⚠ Asserted on the PROPERTY, never through `JSON.stringify`: a swapped
   * prototype renders as an absent key either way, so a stringified comparison
   * reads the broken build as clean.
   */
  test("a __proto__ assertion is CARRIED as an own property, not applied to the prototype", () => {
    // ⚠ Built by `JSON.parse`, not as a literal: an object literal's `__proto__`
    // key is the prototype SETTER (ECMA-262 B.3.1), so a literal input would
    // reach this function carrying no own key at all and the row would pass over
    // an empty bag. This is also the realistic arrival path — a caller matching a
    // parsed introspection response.
    const assert = JSON.parse(String.raw`{"__proto__":"forged"}`) as never;

    const predicate = createJwtValidate(assert);

    expect(Object.hasOwn(predicate, "__proto__")).toBe(true);
    expect(Object.keys(predicate)).toEqual(["__proto__"]);
    expect(Object.getOwnPropertyDescriptor(predicate, "__proto__")?.value).toEqual({
      $eq: "forged",
    });
  });

  // The hash-derive matchers are VERIFY-only, so the halves are asymmetric by
  // design: verify DERIVES the digest from a raw source, assert matches a
  // digest the caller already holds. What must still agree is the VALUE — the
  // two reach the same `$eq`, each under the claim name its own surface speaks.
  describe("hash claims", () => {
    const sources = {
      accessToken: "the-access-token",
      authCode: "the-auth-code",
      authState: "the-auth-state",
    };

    test("should map every hash matcher key to a registry domain claim", () => {
      for (const [key, domain] of Object.entries(HASH_MATCHERS)) {
        expect(claimByDomain(domain), `${key} → ${domain}`).toBeDefined();
      }
    });

    test("should reach the same digest through verify's derive and assert's claim", () => {
      const verifyPredicate = createIdentityMatchers("ES256", sources, joseName);

      for (const [key, domain] of Object.entries(HASH_MATCHERS)) {
        const domainSpec = claimByDomain(domain);
        const jose = (domainSpec && joseName(domainSpec)) as keyof typeof verifyPredicate;
        const digest = createHash("ES256", sources[key as keyof typeof sources]);
        const assertPredicate = createJwtValidate({ [domain]: digest } as never);

        expect(verifyPredicate[jose]).toEqual({ $eq: digest });
        expect(assertPredicate[domain]).toEqual({ $eq: digest });
      }
    });

    // ⛔ THE VERDICT MUST NOT TURN ON KEY ORDER. A raw source and its digest claim
    // resolve to ONE wire name, and the predicate is a plain object — so the
    // second write would displace the first and the caller would believe two
    // bindings were checked when one was. Both orders, all three pairs, because a
    // refusal on one order alone is the bug wearing a test.
    test("should refuse a raw hash source presented beside the digest claim it derives, in either order, on either wire", () => {
      for (const nameOf of [joseName, coseName]) {
        for (const [source, digestClaim] of Object.entries(HASH_MATCHERS)) {
          const raw = sources[source as keyof typeof sources];

          for (const bag of [
            { [source]: raw, [digestClaim]: "a-digest" },
            { [digestClaim]: "a-digest", [source]: raw },
          ]) {
            let thrown: unknown;

            try {
              createIdentityMatchers("ES256", bag, nameOf);
            } catch (error) {
              thrown = error;
            }

            // ⚠ THE WORDS, not just the code: `title` and `details` are what a
            // consumer reads, and nothing else in the package holds them.
            expect(
              {
                code: (thrown as AegisDomainError)?.code,
                title: (thrown as AegisDomainError)?.title,
                details: (thrown as AegisDomainError)?.details,
              },
              JSON.stringify(bag),
            ).toEqual({
              code: "jwt_verify_conflicting_matchers",
              title: "JWT Verify Conflicting Matchers",
              details:
                "Two verify option keys resolve to the same claim, so only one of them could be checked. State the raw source or the digest, never both.",
            });
            expect((thrown as AegisDomainError).data.keys).toEqual(
              expect.arrayContaining([source, digestClaim]),
            );
          }
        }
      }
    });

    // The CONTRAST: each spelling ALONE still builds, so the refusal above is
    // about the pair and not about either key.
    test("should accept the raw source alone and the digest claim alone", () => {
      for (const [source, digestClaim] of Object.entries(HASH_MATCHERS)) {
        const raw = sources[source as keyof typeof sources];

        for (const nameOf of [joseName, coseName]) {
          expect(() =>
            createIdentityMatchers("ES256", { [source]: raw }, nameOf),
          ).not.toThrow();
          expect(() =>
            createIdentityMatchers("ES256", { [digestClaim]: "a-digest" }, nameOf),
          ).not.toThrow();
        }
      }
    });
  });
});
