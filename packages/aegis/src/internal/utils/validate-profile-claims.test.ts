import { describe, expect, test } from "vitest";
import { JwtError } from "../../errors/index.js";
import { accessTokenProfile } from "../profiles/definitions/access-token.js";
import { securityEventProfile } from "../profiles/definitions/security-event.js";
import { validateProfileClaims } from "./validate-profile-claims.js";

// DOMAIN-keyed claim sets (validateProfileClaims runs the rules on the common
// layer); timestamps are Dates.
const d = (unix: number): Date => new Date(unix * 1000);

describe("validateProfileClaims", () => {
  test("passes for a conformant access token claim set", () => {
    expect(() =>
      validateProfileClaims(
        accessTokenProfile,
        {
          issuer: "https://test.lindorm.io/",
          subject: "s",
          audience: ["https://rs"],
          clientId: "c",
          issuedAt: d(100),
          expiresAt: d(200),
          tokenId: "j",
        },
        { algorithm: "ES512" },
      ),
    ).not.toThrow();
  });

  test("throws when the access token aud has multiple resources", () => {
    expect(() =>
      validateProfileClaims(
        accessTokenProfile,
        {
          issuer: "https://test.lindorm.io/",
          audience: ["https://a", "https://b"],
          issuedAt: d(100),
          expiresAt: d(200),
        },
        { algorithm: "ES512" },
      ),
    ).toThrow(JwtError);
  });

  test("throws when the access token signing alg is symmetric", () => {
    expect(() =>
      validateProfileClaims(
        accessTokenProfile,
        { audience: ["https://rs"], issuedAt: d(100), expiresAt: d(200) },
        { algorithm: "HS256" },
      ),
    ).toThrow(JwtError);
  });

  test("throws when a security event sub_id is malformed", () => {
    expect(() =>
      validateProfileClaims(
        securityEventProfile,
        {
          issuer: "https://test.lindorm.io/",
          subjectId: { format: "iss_sub" },
          events: { "urn:lindorm:event:test": {} },
        },
        { algorithm: "ES512" },
      ),
    ).toThrow(JwtError);
  });
});
