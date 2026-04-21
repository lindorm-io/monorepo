import { extractAegisProfile } from "./extract-aegis-profile";
import { describe, expect, test } from "vitest";

describe("extractAegisProfile", () => {
  describe("snake_case input", () => {
    test("should extract profile fields from snake_case wire format", () => {
      const wire = {
        given_name: "John",
        family_name: "Doe",
        email: "john@example.com",
        email_verified: true,
        custom_claim: "value",
      };

      const result = extractAegisProfile(wire);

      expect(result).toMatchSnapshot();
    });

    test("should return undefined profile when no profile fields present", () => {
      const wire = { custom_claim: "value", another: 42 };

      const result = extractAegisProfile(wire);

      expect(result).toMatchSnapshot();
    });

    test("should handle address field", () => {
      const wire = {
        address: { street_address: "123 Main St", locality: "Springfield" },
        given_name: "Jane",
      };

      const result = extractAegisProfile(wire);

      expect(result).toMatchSnapshot();
    });

    test("should handle all lindorm extension fields", () => {
      const wire = {
        display_name: "Johnny",
        honorific: "Dr.",
        legal_name: "Jonathan Doe",
        legal_name_verified: true,
        naming_system: "given_family",
        preferred_accessibility: ["high_contrast"],
        preferred_name: "John",
        pronouns: "he/him",
        department: "Engineering",
        job_title: "Staff Engineer",
        occupation: "Software Engineer",
        organization: "Acme Corp",
      };

      const result = extractAegisProfile(wire);

      expect(result).toMatchSnapshot();
    });
  });

  describe("camelCase input", () => {
    test("should extract profile fields from camelCase data", () => {
      const data = {
        givenName: "John",
        familyName: "Doe",
        email: "john@example.com",
        emailVerified: true,
        sub: "user-123",
        permissions: ["read"],
      };

      const result = extractAegisProfile(data);

      expect(result).toMatchSnapshot();
    });

    test("should return undefined profile when no profile fields present", () => {
      const data = { sub: "user-123", permissions: ["read"] };

      const result = extractAegisProfile(data);

      expect(result).toMatchSnapshot();
    });

    test("should handle all standard OIDC profile fields", () => {
      const data = {
        birthdate: "1990-01-01",
        familyName: "Doe",
        gender: "male",
        givenName: "John",
        locale: "en-US",
        middleName: "Michael",
        name: "John Michael Doe",
        nickname: "Johnny",
        picture: "https://example.com/photo.jpg",
        preferredUsername: "johnd",
        profile: "https://example.com/johnd",
        updatedAt: 1700000000,
        website: "https://johndoe.example.com",
        zoneinfo: "America/New_York",
      };

      const result = extractAegisProfile(data);

      expect(result).toMatchSnapshot();
    });
  });
});
