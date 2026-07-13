import { describe, expect, test } from "vitest";
import {
  redactSensitiveIdentity,
  redactVerifyOptions,
} from "./redact-sensitive-identity.js";

const NIN = "19900101-1234";
const SSN = "078-05-1120";

describe("redactSensitiveIdentity", () => {
  test("filters the domain identity numbers and keeps the verified flags", () => {
    expect(
      redactSensitiveIdentity({
        subject: "sub-1",
        sensitiveIdentity: {
          nationalIdentityNumber: NIN,
          nationalIdentityNumberVerified: true,
          socialSecurityNumber: SSN,
          socialSecurityNumberVerified: false,
        },
      }),
    ).toMatchSnapshot();
  });

  test("filters the wire identity numbers and keeps the verified flags", () => {
    expect(
      redactSensitiveIdentity({
        sub: "sub-1",
        sensitive_identity: {
          national_identity_number: NIN,
          national_identity_number_verified: true,
          social_security_number: SSN,
        },
      }),
    ).toMatchSnapshot();
  });

  test("never emits the identity numbers", () => {
    const serialised = JSON.stringify(
      redactSensitiveIdentity({
        sensitiveIdentity: { nationalIdentityNumber: NIN, socialSecurityNumber: SSN },
        sensitive_identity: { national_identity_number: NIN },
      }),
    );

    expect(serialised).not.toContain(NIN);
    expect(serialised).not.toContain(SSN);
  });

  test("leaves a payload without sensitive identity untouched", () => {
    const payload = { subject: "sub-1", scope: "openid" };

    expect(redactSensitiveIdentity(payload)).toBe(payload);
  });

  test("tolerates a null sensitive identity", () => {
    expect(
      redactSensitiveIdentity({ subject: "sub-1", sensitiveIdentity: null }),
    ).toMatchSnapshot();
  });

  test("tolerates a non-object sensitive identity", () => {
    expect(redactSensitiveIdentity({ sensitiveIdentity: "nonsense" })).toMatchSnapshot();
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
