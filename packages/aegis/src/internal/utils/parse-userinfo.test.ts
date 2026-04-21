import { AegisError } from "../../errors";
import { AegisProfile, ParsedJwtPayload } from "../../types";
import { parseUserinfo, UserinfoClaimsInput } from "./parse-userinfo";
import { describe, expect, test } from "vitest";

describe("parseUserinfo", () => {
  describe("plain claims input", () => {
    test("should map standard OIDC claims to AegisUserinfo", () => {
      const data = {
        sub: "user-abc-123",
        givenName: "John",
        familyName: "Doe",
        email: "john@example.com",
        emailVerified: true,
        phoneNumber: "+1234567890",
        phoneNumberVerified: false,
        picture: "https://example.com/photo.jpg",
        birthdate: "1990-01-01",
        gender: "male",
        locale: "en-US",
        name: "John Doe",
        nickname: "Johnny",
        preferredUsername: "johnd",
        profile: "https://example.com/johnd",
        website: "https://johndoe.example.com",
        zoneinfo: "America/New_York",
        updatedAt: 1700000000,
      } as unknown as UserinfoClaimsInput;

      const result = parseUserinfo(data);

      expect(result).toMatchSnapshot();
    });

    test("should handle minimal claims with only sub", () => {
      const data = { sub: "user-minimal" } as unknown as UserinfoClaimsInput;

      const result = parseUserinfo(data);

      expect(result).toMatchSnapshot();
    });

    test("should throw AegisError when sub is missing", () => {
      const data = {
        givenName: "John",
        familyName: "Doe",
      } as unknown as UserinfoClaimsInput;

      expect(() => parseUserinfo(data)).toThrow(AegisError);
      expect(() => parseUserinfo(data)).toThrow("Missing subject claim");
    });

    test("should include lindorm extension fields", () => {
      const data = {
        sub: "user-ext-123",
        displayName: "Johnny D",
        honorific: "Dr.",
        pronouns: "he/him",
        department: "Engineering",
        jobTitle: "Staff Engineer",
        organization: "Acme Corp",
      } as unknown as UserinfoClaimsInput;

      const result = parseUserinfo(data);

      expect(result).toMatchSnapshot();
    });
  });

  describe("ParsedJwtPayload input", () => {
    test("should extract profile from ParsedJwtPayload", () => {
      const profile: AegisProfile = {
        givenName: "Jane",
        familyName: "Smith",
        email: "jane@example.com",
        emailVerified: true,
        locale: "en-GB",
      };

      const data = {
        subject: "user-jwt-456",
        profile,
        audience: ["https://api.example.com"],
        authMethods: ["pwd"],
        claims: {},
        confirmation: undefined,
        entitlements: [],
        groups: [],
        issuer: "https://auth.example.com",
        permissions: [],
        roles: [],
        scope: ["openid", "profile"],
        tokenId: "tok-123",
      } as unknown as ParsedJwtPayload;

      const result = parseUserinfo(data);

      expect(result).toMatchSnapshot();
    });

    test("should throw AegisError when subject is missing on ParsedJwtPayload", () => {
      const data = {
        profile: { givenName: "Jane" },
      } as unknown as ParsedJwtPayload;

      expect(() => parseUserinfo(data)).toThrow(AegisError);
      expect(() => parseUserinfo(data)).toThrow("Missing subject claim");
    });
  });
});
