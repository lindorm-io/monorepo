import { describe, expect, test } from "vitest";
import { UserinfoEndpointFailed } from "../../../errors/UserinfoEndpointFailed.js";
import { parseUserinfo, type UserinfoClaimsInput } from "./parse-userinfo.js";

describe("parseUserinfo", () => {
  describe("plain claims input", () => {
    test("should map standard OIDC claims to PylonUserinfo", () => {
      const data = {
        sub: "user-abc-123",
        given_name: "John",
        family_name: "Doe",
        email: "john@example.com",
        email_verified: true,
        phone_number: "+1234567890",
        phone_number_verified: false,
        picture: "https://example.com/photo.jpg",
        birthdate: "1990-01-01",
        gender: "male",
        locale: "en-US",
        name: "John Doe",
        nickname: "Johnny",
        preferred_username: "johnd",
        profile: "https://example.com/johnd",
        website: "https://johndoe.example.com",
        zoneinfo: "America/New_York",
        updated_at: 1700000000,
      } as unknown as UserinfoClaimsInput;

      const result = parseUserinfo(data);

      expect(result).toMatchSnapshot();
    });

    // The provider decided the release from the granted scope before it wrote
    // the response — pylon returns what it was given rather than re-deciding.
    // Deliberately the OPPOSITE of `parseIntrospection`, which drops these.
    test("should keep SENSITIVE claims released by the userinfo endpoint", () => {
      const data = {
        sub: "user-abc-123",
        given_name: "John",
        national_identity_number: "19900101-1234",
        national_identity_number_verified: true,
        social_security_number: "123-45-6789",
      };

      expect(parseUserinfo(data as UserinfoClaimsInput)).toMatchSnapshot();
    });

    test("should handle minimal claims with only sub", () => {
      const data = { sub: "user-minimal" } as unknown as UserinfoClaimsInput;

      const result = parseUserinfo(data);

      expect(result).toMatchSnapshot();
    });

    test("should throw UserinfoEndpointFailed when sub is missing", () => {
      const data = {
        given_name: "John",
        family_name: "Doe",
      } as unknown as UserinfoClaimsInput;

      expect(() => parseUserinfo(data)).toThrow(UserinfoEndpointFailed);
      expect(() => parseUserinfo(data)).toThrow("Missing subject claim");
    });

    test("should include lindorm extension fields", () => {
      const data = {
        sub: "user-ext-123",
        display_name: "Johnny D",
        honorific: "Dr.",
        pronouns: "he/him",
        department: "Engineering",
        job_title: "Staff Engineer",
        organization: "Acme Corp",
      } as unknown as UserinfoClaimsInput;

      const result = parseUserinfo(data);

      expect(result).toMatchSnapshot();
    });
  });

  describe("domain payload input", () => {
    test("should throw UserinfoEndpointFailed when subject is missing on a domain payload", () => {
      const data = {
        profile: { givenName: "Jane" },
      } as unknown as UserinfoClaimsInput;

      expect(() => parseUserinfo(data)).toThrow(UserinfoEndpointFailed);
      expect(() => parseUserinfo(data)).toThrow("Missing subject claim");
    });
  });
});
