import { describe, expect, test } from "vitest";
import { JwtError } from "../../errors/index.js";
import { accessTokenProfile } from "../profiles/definitions/access-token.js";
import { idTokenProfile } from "../profiles/definitions/id-token.js";
import { assembleCommonClaims } from "./assemble-common-claims.js";

// Anchored to real-now: @lindorm/date `expires` rejects past expiry dates.
const NOW = new Date();
const ctx = {
  algorithm: "ES256" as const,
  issuer: "https://issuer.lindorm.io/",
  now: NOW,
};

describe("assembleCommonClaims", () => {
  test("produces a DOMAIN-keyed dict with the injected envelope", () => {
    const explicitExpiry = new Date(NOW.getTime() + 3600 * 1000);
    const common = assembleCommonClaims(ctx, accessTokenProfile, {
      subject: "user-1",
      audience: ["https://rs.lindorm.io/"],
      clientId: "client-1",
      expires: explicitExpiry,
    } as any);

    // domain keys, not wire keys
    expect(common.subject).toBe("user-1");
    expect(common.audience).toEqual(["https://rs.lindorm.io/"]);
    expect(common.clientId).toBe("client-1");
    expect(common.iss).toBeUndefined();
    expect(common.sub).toBeUndefined();

    // envelope injected in domain form
    expect(common.issuer).toBe("https://issuer.lindorm.io/"); // platform + autoInject.iss
    expect(common.issuedAt).toEqual(NOW); // autoInject.iat
    expect(common.expiresAt).toEqual(explicitExpiry); // explicit content.expires
    expect(typeof common.tokenId).toBe("string"); // autoInject.jti
    expect(common.notBefore).toBeUndefined(); // access token does not auto-inject nbf
  });

  test("derives expiresAt from the profile lifetime when content.expires is absent", () => {
    const common = assembleCommonClaims(ctx, accessTokenProfile, {
      subject: "u",
      audience: ["a"],
      clientId: "c",
    } as any);
    expect(common.expiresAt).toBeInstanceOf(Date); // access_token lifetime "1h"
  });

  test("computes OIDC hash claims under domain names", () => {
    const common = assembleCommonClaims(ctx, idTokenProfile, {
      subject: "user-1",
      audience: ["client-1"],
      accessToken: "the-access-token",
      authCode: "the-code",
    } as any);

    expect(typeof common.accessTokenHash).toBe("string");
    expect(typeof common.codeHash).toBe("string");
    expect(common.at_hash).toBeUndefined(); // domain key, not wire
  });

  test("merges custom passthrough claims under their literal key", () => {
    const common = assembleCommonClaims(ctx, accessTokenProfile, {
      subject: "user-1",
      audience: ["https://rs.lindorm.io/"],
      clientId: "client-1",
      claims: { token_introspection: { active: true } },
    } as any);

    expect(common.token_introspection).toEqual({ active: true });
  });

  describe("policy enforcement (domain-keyed)", () => {
    test("throws when a required domain claim is missing", () => {
      // access_token requires subject — omit it
      expect(() =>
        assembleCommonClaims(ctx, accessTokenProfile, {
          audience: ["a"],
          clientId: "c",
        } as any),
      ).toThrow(JwtError);
    });

    test("throws when a forbidden domain claim is present", () => {
      // a profile that forbids `nonce` (domain) with nonce supplied
      const forbidsNonce = { ...accessTokenProfile, forbidden: ["nonce"] };
      expect(() =>
        assembleCommonClaims(ctx, forbidsNonce, {
          subject: "u",
          audience: ["a"],
          clientId: "c",
          nonce: "n",
        } as any),
      ).toThrow(JwtError);
    });

    test("passes when all required domain claims are present", () => {
      expect(() =>
        assembleCommonClaims(ctx, accessTokenProfile, {
          subject: "u",
          audience: ["a"],
          clientId: "c",
        } as any),
      ).not.toThrow();
    });
  });

  test("honours a per-token issuer profile (no platform injection)", () => {
    // id_token issues per the platform; use a content issuer override path via
    // a per-token-style assertion: access token is platform, so issuer = ctx.
    const common = assembleCommonClaims({ ...ctx, issuer: null }, accessTokenProfile, {
      subject: "u",
      audience: ["a"],
      clientId: "c",
      issuer: "https://other/",
    } as any);
    // platform profile with null ctx issuer falls back to the content issuer
    expect(common.issuer).toBe("https://other/");
  });
});
