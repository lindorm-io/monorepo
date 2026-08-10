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
    test("should hash the assert-only derive inputs before the lift", () => {
      expect(
        createJwtValidate({
          algorithm: "ES256",
          accessToken: "the-access-token",
          authCode: "the-auth-code",
          authState: "the-auth-state",
        }),
      ).toMatchSnapshot();
    });

    test("should not emit a predicate key for the algorithm knob", () => {
      expect(createJwtValidate({ algorithm: "ES256", subject: "s" })).toEqual({
        subject: { $eq: "s" },
      });
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
});
