import { describe, expect, test } from "vitest";
import { JwtError } from "../../errors/index.js";
import { accessTokenProfile } from "../profiles/definitions/access-token.js";
import { securityEventProfile } from "../profiles/definitions/security-event.js";
import { validateProfileClaims } from "./validate-profile-claims.js";

describe("validateProfileClaims", () => {
  test("passes for a conformant access token claim set", () => {
    expect(() =>
      validateProfileClaims(
        accessTokenProfile,
        {
          iss: "https://test.lindorm.io/",
          sub: "s",
          aud: ["https://rs"],
          client_id: "c",
          iat: 100,
          exp: 200,
          jti: "j",
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
          iss: "https://test.lindorm.io/",
          aud: ["https://a", "https://b"],
          iat: 100,
          exp: 200,
        },
        { algorithm: "ES512" },
      ),
    ).toThrow(JwtError);
  });

  test("throws when the access token signing alg is symmetric", () => {
    expect(() =>
      validateProfileClaims(
        accessTokenProfile,
        { aud: ["https://rs"], iat: 100, exp: 200 },
        { algorithm: "HS256" },
      ),
    ).toThrow(JwtError);
  });

  test("throws when a security event sub_id is malformed", () => {
    expect(() =>
      validateProfileClaims(
        securityEventProfile,
        {
          iss: "https://test.lindorm.io/",
          sub_id: { format: "iss_sub" },
          events: { "urn:lindorm:event:test": {} },
        },
        { algorithm: "ES512" },
      ),
    ).toThrow(JwtError);
  });
});
