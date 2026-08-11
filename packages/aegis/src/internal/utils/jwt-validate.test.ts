import { createHash } from "./create-hash.js";
import { HASH_MATCHERS } from "./hash-matchers.js";
import { createIdentityMatchers } from "./jwt-identity-matchers.js";
import { createJwtValidate } from "./jwt-validate.js";
import { claimByDomain, joseName } from "../claims/claims-registry.js";
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
      const jose = claimByDomain(key)?.jose as keyof typeof verifyPredicate;

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
        const jose = claimByDomain(domain)?.jose as keyof typeof verifyPredicate;
        const digest = createHash("ES256", sources[key as keyof typeof sources]);
        const assertPredicate = createJwtValidate({ [domain]: digest } as never);

        expect(verifyPredicate[jose]).toEqual({ $eq: digest });
        expect(assertPredicate[domain]).toEqual({ $eq: digest });
      }
    });
  });
});
