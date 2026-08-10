import { createHash } from "./create-hash.js";
import { HASH_MATCHERS } from "./hash-matchers.js";
import { createIdentityMatchers } from "./jwt-identity-matchers.js";
import { createJwtValidate } from "./jwt-validate.js";
import { claimByDomain } from "../claims/claims-registry.js";
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

  describe("hash-derive inputs", () => {
    // The raw source value is hashed into the DOMAIN claim mint wrote it to —
    // not into the option key, and not into the wire name (which is the verify
    // half's vocabulary, because that half matches a wire payload).
    test("should key the hash by the domain claim, not the option key", () => {
      const predicate = createJwtValidate(
        {
          accessToken: "the-access-token",
          authCode: "the-auth-code",
          authState: "the-auth-state",
        },
        "ES256",
      );

      expect(Object.keys(predicate)).toEqual([
        "accessTokenHash",
        "codeHash",
        "stateHash",
      ]);
      expect(predicate).toMatchSnapshot();
    });

    test("should hash each source with the token algorithm", () => {
      expect(createJwtValidate({ accessToken: "raw" }, "ES256")).toEqual({
        accessTokenHash: { $eq: createHash("ES256", "raw") },
      });
      expect(createJwtValidate({ accessToken: "raw" }, "RS512")).toEqual({
        accessTokenHash: { $eq: createHash("RS512", "raw") },
      });
    });

    // A caller holding the hash already matches it as an ordinary equality
    // claim through the normal path — no `algorithm` needed.
    test("should accept a pre-computed hash as a plain equality matcher", () => {
      expect(createJwtValidate({ accessTokenHash: "precomputed" } as never)).toEqual({
        accessTokenHash: { $eq: "precomputed" },
      });
      expect(createJwtValidate({ codeHash: "precomputed" } as never)).toEqual({
        codeHash: { $eq: "precomputed" },
      });
      expect(createJwtValidate({ stateHash: "precomputed" } as never)).toEqual({
        stateHash: { $eq: "precomputed" },
      });
    });

    test("should not emit a predicate key for the algorithm knob", () => {
      expect(createJwtValidate({ subject: "s" }, "ES256")).toEqual({
        subject: { $eq: "s" },
      });
    });

    // Without `algorithm` there is no hash to compare, and the value used to
    // fall through to the ordinary lift — producing `{ accessToken: { $eq:
    // "raw" } }`, a key no claim set carries. Fails closed, but silently.
    test.each(["accessToken", "authCode", "authState"] as const)(
      "should throw when %s is given without an algorithm",
      (key) => {
        expect(() => createJwtValidate({ [key]: "raw" })).toThrowError(
          /Missing algorithm/,
        );
      },
    );

    test("should name the offending key and the claim it would derive", () => {
      try {
        createJwtValidate({ accessToken: "raw" });
        throw new Error("expected createJwtValidate to throw");
      } catch (err: any) {
        expect(err.code).toBe("jwt_validate_missing_algorithm");
        expect(err.data).toEqual({ key: "accessToken", claim: "accessTokenHash" });
      }
    });

    // The source of a hash matcher is a RAW string. Anything else cannot be
    // hashed, and lifting it would key the predicate by the source name again.
    test("should throw when a hash-derive input is not a string", () => {
      expect(() =>
        createJwtValidate({ accessToken: { $eq: "raw" } } as never, "ES256"),
      ).toThrowError(/Unsupported value/);
    });
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
    const verifyPredicate = createIdentityMatchers("ES256", matchers);

    for (const key of Object.keys(matchers)) {
      const jose = claimByDomain(key)?.jose as keyof typeof verifyPredicate;

      expect(jose).toBeDefined();
      expect(verifyPredicate[jose]).toEqual(
        assertPredicate[key as keyof typeof assertPredicate],
      );
    }
  });

  test("should build the verify predicate unchanged", () => {
    expect(createIdentityMatchers("ES256", matchers)).toMatchSnapshot();
  });

  test("should build the assert predicate", () => {
    expect(createJwtValidate(matchers as never)).toMatchSnapshot();
  });

  // The hash-derive inputs are the one place the two halves legitimately write
  // different KEYS from the same table — the wire name on the verify side, the
  // domain name on the assert side — but the hashed VALUE must be identical.
  describe("hash-derive inputs", () => {
    const sources = {
      accessToken: "the-access-token",
      authCode: "the-auth-code",
      authState: "the-auth-state",
    };

    test("should map every option key to a registry domain claim", () => {
      for (const [key, domain] of Object.entries(HASH_MATCHERS)) {
        expect(claimByDomain(domain), `${key} → ${domain}`).toBeDefined();
      }
    });

    test("should hash to the same value under each half's own claim name", () => {
      const assertPredicate = createJwtValidate(sources, "ES256");
      const verifyPredicate = createIdentityMatchers("ES256", sources);

      for (const [key, domain] of Object.entries(HASH_MATCHERS)) {
        const jose = claimByDomain(domain)?.jose as keyof typeof verifyPredicate;
        const hashed = { $eq: createHash("ES256", sources[key as keyof typeof sources]) };

        expect(assertPredicate[domain]).toEqual(hashed);
        expect(verifyPredicate[jose]).toEqual(hashed);
      }
    });
  });
});
