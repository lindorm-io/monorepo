import { describe, expect, test } from "vitest";
import { extractSensitiveIdentity } from "./extract-sensitive-identity.js";

describe("extractSensitiveIdentity", () => {
  test("should extract from snake_case wire-form claim", () => {
    const data = {
      sub: "user-1",
      sensitive_identity: {
        national_identity_number: "19900101-1234",
        national_identity_number_verified: true,
        social_security_number: "123-45-6789",
        social_security_number_verified: false,
      },
    };

    expect(extractSensitiveIdentity(data)).toMatchSnapshot();
  });

  test("should extract from camelCase pre-extracted claim", () => {
    const data = {
      sub: "user-1",
      sensitiveIdentity: {
        nationalIdentityNumber: "19900101-1234",
        nationalIdentityNumberVerified: true,
      },
    };

    expect(extractSensitiveIdentity(data)).toMatchSnapshot();
  });

  test("should return undefined when claim absent", () => {
    const data = { sub: "user-1", custom: "value" };

    expect(extractSensitiveIdentity(data)).toMatchSnapshot();
  });

  test("should return undefined when claim is empty object", () => {
    const data = { sub: "user-1", sensitive_identity: {} };

    expect(extractSensitiveIdentity(data)).toMatchSnapshot();
  });

  test("should return undefined when claim is not an object", () => {
    const data = { sub: "user-1", sensitive_identity: "not-an-object" };

    expect(extractSensitiveIdentity(data)).toMatchSnapshot();
  });

  test("should leave other keys untouched in rest", () => {
    const data = {
      sub: "user-1",
      email: "a@b.c",
      sensitive_identity: { national_identity_number: "x" },
      custom_claim: 42,
    };

    expect(extractSensitiveIdentity(data)).toMatchSnapshot();
  });
});
