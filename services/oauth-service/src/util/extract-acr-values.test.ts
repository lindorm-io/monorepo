import {
  AuthenticationFactor,
  AuthenticationLevel,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-types";
import { extractAcrValues } from "./extract-acr-values";

describe("filterAcrValues", () => {
  test("should resolve all desired values", () => {
    expect(
      extractAcrValues(
        [
          AuthenticationFactor.PHISHING_RESISTANT_HARDWARE,
          AuthenticationFactor.TWO_FACTOR,
          AuthenticationLevel.LOA_3,
          AuthenticationMethod.DEVICE_LINK,
          AuthenticationMethod.MFA_COOKIE,
          AuthenticationStrategy.EMAIL_CODE,
          AuthenticationStrategy.PASSWORD_BROWSER_LINK,
          AuthenticationStrategy.PHONE_OTP,
        ].join(" "),
      ),
    ).toStrictEqual({
      factors: ["urn:lindorm:auth:acr:phrh", "urn:lindorm:auth:acr:2fa"],
      levelOfAssurance: 3,
      methods: ["urn:lindorm:auth:method:device-link", "urn:lindorm:auth:method:mfa-cookie"],
      strategies: [
        "urn:lindorm:auth:strategy:email-code",
        "urn:lindorm:auth:strategy:password-browser-link",
        "urn:lindorm:auth:strategy:phone-otp",
      ],
    });
  });

  test("should skip level of assurance", () => {
    expect(
      extractAcrValues(
        [
          AuthenticationFactor.PHISHING_RESISTANT_HARDWARE,
          AuthenticationMethod.DEVICE_LINK,
          AuthenticationStrategy.EMAIL_CODE,
        ].join(" "),
      ),
    ).toStrictEqual({
      factors: ["urn:lindorm:auth:acr:phrh"],
      levelOfAssurance: 0,
      methods: ["urn:lindorm:auth:method:device-link"],
      strategies: ["urn:lindorm:auth:strategy:email-code"],
    });
  });

  test("should resolve the highest desired level of assurance", () => {
    expect(
      extractAcrValues(
        [AuthenticationLevel.LOA_2, AuthenticationLevel.LOA_1, AuthenticationLevel.LOA_4].join(" "),
      ),
    ).toStrictEqual({
      factors: [],
      levelOfAssurance: 4,
      methods: [],
      strategies: [],
    });
  });

  test("should filter out duplicates", () => {
    expect(
      extractAcrValues(
        [
          AuthenticationFactor.PHISHING_RESISTANT_HARDWARE,
          AuthenticationFactor.PHISHING_RESISTANT_HARDWARE,
          AuthenticationLevel.LOA_3,
          AuthenticationLevel.LOA_3,
          AuthenticationMethod.DEVICE_LINK,
          AuthenticationMethod.DEVICE_LINK,
          AuthenticationStrategy.EMAIL_CODE,
          AuthenticationStrategy.EMAIL_CODE,
        ].join(" "),
      ),
    ).toStrictEqual({
      factors: ["urn:lindorm:auth:acr:phrh"],
      levelOfAssurance: 3,
      methods: ["urn:lindorm:auth:method:device-link"],
      strategies: ["urn:lindorm:auth:strategy:email-code"],
    });
  });

  test("should resolve with no input", () => {
    expect(extractAcrValues()).toStrictEqual({
      factors: [],
      levelOfAssurance: 0,
      methods: [],
      strategies: [],
    });
  });
});
