import type { AegisProfile } from "@lindorm/aegis";
import { describe, expect, test } from "vitest";
import { UserinfoEndpointFailed } from "../../../errors/UserinfoEndpointFailed.js";
import { parseUserinfo, type UserinfoClaimsInput } from "./parse-userinfo.js";

describe("parseUserinfo", () => {
  describe("plain claims input", () => {
    test("should map standard OIDC claims to PylonUserinfo", () => {
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

    test("should throw UserinfoEndpointFailed when sub is missing", () => {
      const data = {
        givenName: "John",
        familyName: "Doe",
      } as unknown as UserinfoClaimsInput;

      expect(() => parseUserinfo(data)).toThrow(UserinfoEndpointFailed);
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

  describe("domain payload input", () => {
    test("should extract profile from a domain payload", () => {
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
      } as unknown as UserinfoClaimsInput;

      const result = parseUserinfo(data);

      expect(result).toMatchSnapshot();
    });

    test("should throw UserinfoEndpointFailed when subject is missing on a domain payload", () => {
      const data = {
        profile: { givenName: "Jane" },
      } as unknown as UserinfoClaimsInput;

      expect(() => parseUserinfo(data)).toThrow(UserinfoEndpointFailed);
      expect(() => parseUserinfo(data)).toThrow("Missing subject claim");
    });
  });
});
