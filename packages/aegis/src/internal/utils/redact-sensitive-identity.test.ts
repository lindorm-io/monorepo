import { describe, expect, test } from "vitest";
import {
  redactSensitiveIdentity,
  redactVerifyOptions,
} from "./redact-sensitive-identity.js";

const NIN = "19900101-1234";
const SSN = "078-05-1120";

describe("redactSensitiveIdentity", () => {
  test("filters the FLAT wire identity numbers and keeps the verified flags", () => {
    expect(
      redactSensitiveIdentity({
        sub: "sub-1",
        national_identity_number: NIN,
        national_identity_number_verified: true,
        social_security_number: SSN,
        social_security_number_verified: false,
      }),
    ).toMatchSnapshot();
  });

  test("filters the FLAT camelCase domain identity numbers too", () => {
    expect(
      redactSensitiveIdentity({
        subject: "sub-1",
        nationalIdentityNumber: NIN,
        nationalIdentityNumberVerified: true,
        socialSecurityNumber: SSN,
        socialSecurityNumberVerified: false,
      }),
    ).toMatchSnapshot();
  });

  test("never emits the identity numbers", () => {
    const serialised = JSON.stringify(
      redactSensitiveIdentity({
        nationalIdentityNumber: NIN,
        social_security_number: SSN,
      }),
    );

    expect(serialised).not.toContain(NIN);
    expect(serialised).not.toContain(SSN);
  });

  test("leaves a payload without an identity number untouched", () => {
    const payload = { subject: "sub-1", scope: "openid" };

    expect(redactSensitiveIdentity(payload)).toBe(payload);
  });

  test("leaves a payload carrying only a verified flag untouched", () => {
    const payload = { subject: "sub-1", national_identity_number_verified: true };

    expect(redactSensitiveIdentity(payload)).toBe(payload);
  });

  test("tolerates a null identity number", () => {
    expect(
      redactSensitiveIdentity({ subject: "sub-1", nationalIdentityNumber: null }),
    ).toMatchSnapshot();
  });
});

describe("redactVerifyOptions", () => {
  test("sanitises a dpop proof to its header and payload", () => {
    expect(
      redactVerifyOptions({
        audience: "aud",
        dpopProof: "header-segment.payload-segment.signature-segment",
      }),
    ).toMatchSnapshot();
  });

  test("leaves options without a proof untouched", () => {
    const options = { audience: "aud" };

    expect(redactVerifyOptions(options)).toBe(options);
  });
});
