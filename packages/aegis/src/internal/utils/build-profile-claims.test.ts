import MockDate from "mockdate";
import type { TokenProfile } from "../../types/index.js";
import { defaultProfile } from "../profiles/definitions/default.js";
import { buildProfileClaims } from "./build-profile-claims.js";
import { describe, expect, test } from "vitest";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const CTX = { algorithm: "ES512" as const, issuer: "https://test.lindorm.io/" };

const noInjectProfile: TokenProfile = {
  name: "no_inject",
  typ: null,
  required: [],
  forbidden: [],
  requiredWhen: [],
  atLeastOneOf: [],
  autoInject: { iat: false, jti: false, nbf: false, iss: false },
  issuer: "platform",
  lifetime: null,
  encryptable: false,
  validate: () => [],
};

describe("buildProfileClaims", () => {
  test("default profile auto-injects iat/jti/nbf/iss and derives exp", () => {
    const claims = buildProfileClaims(CTX, defaultProfile, {
      subject: "subject-1",
      expires: "1h",
      tokenType: "test_token",
    });

    expect(claims).toMatchObject({
      sub: "subject-1",
      iss: "https://test.lindorm.io/",
      iat: 1704096000,
      nbf: 1704096000,
      exp: 1704099600,
    });
    expect(typeof claims.jti).toBe("string");
  });

  test("does not inject envelope claims when autoInject is all false", () => {
    const claims = buildProfileClaims(CTX, noInjectProfile, {
      subject: "subject-1",
    });

    expect(claims.iat).toBeUndefined();
    expect(claims.jti).toBeUndefined();
    expect(claims.nbf).toBeUndefined();
    expect(claims.iss).toBeUndefined();
  });

  test("lifetime null with no expires yields no exp", () => {
    const claims = buildProfileClaims(CTX, noInjectProfile, {
      subject: "subject-1",
    });

    expect(claims.exp).toBeUndefined();
  });

  test("lifetime derives exp when content omits expires", () => {
    const claims = buildProfileClaims(
      CTX,
      { ...noInjectProfile, lifetime: "1h" },
      { subject: "subject-1" },
    );

    expect(claims.exp).toBe(1704099600);
  });

  test("content.expires wins over profile.lifetime", () => {
    const claims = buildProfileClaims(
      CTX,
      { ...noInjectProfile, lifetime: "10h" },
      { subject: "subject-1", expires: "1h" },
    );

    expect(claims.exp).toBe(1704099600);
  });

  // Policy (required/forbidden/atLeastOneOf/requiredWhen) is now enforced on the
  // DOMAIN-keyed common layer — see assemble-common-claims.test.ts. This file
  // only covers buildProfileClaims as the pure JOSE wire mapper + envelope.
});
