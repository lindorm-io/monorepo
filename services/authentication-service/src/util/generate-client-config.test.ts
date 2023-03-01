import { createTestAuthenticationSession } from "../fixtures/entity";
import { generateClientConfig } from "./generate-client-config";
import { AuthenticationMethod, AuthenticationStrategy } from "@lindorm-io/common-types";

describe("calculateMethodsAndStrategies", () => {
  test("should calculate first factor values", () => {
    expect(
      generateClientConfig(
        createTestAuthenticationSession({
          allowedStrategies: [
            AuthenticationStrategy.DEVICE_CHALLENGE,
            AuthenticationStrategy.EMAIL_CODE,
            AuthenticationStrategy.EMAIL_OTP,
            AuthenticationStrategy.PASSWORD,
            AuthenticationStrategy.PASSWORD_BROWSER_LINK,
            AuthenticationStrategy.RDC_QR_CODE,
            AuthenticationStrategy.SESSION_ACCEPT_WITH_CODE,
            AuthenticationStrategy.WEBAUTHN,
          ],
          recommendedMethods: [],
          requiredLevel: 1,
          requiredMethods: [],
        }),
      ),
    ).toStrictEqual([
      {
        identifierHint: "none",
        identifierType: "none",
        method: "device_link",
        rank: 1,
        recommended: false,
        required: false,
        strategies: ["device_challenge"],
      },
      {
        identifierHint: "none",
        identifierType: "none",
        method: "session_link",
        rank: 2,
        recommended: false,
        required: false,
        strategies: ["session_accept_with_code"],
      },
      {
        identifierHint: "email",
        identifierType: "email",
        method: "email",
        rank: 3,
        recommended: false,
        required: false,
        strategies: ["email_otp", "email_code"],
      },
      {
        identifierHint: "none",
        identifierType: "username",
        method: "password",
        rank: 4,
        recommended: false,
        required: false,
        strategies: ["password_browser_link", "password"],
      },
    ]);
  });

  test("should calculate second factor values", () => {
    expect(
      generateClientConfig(
        createTestAuthenticationSession({
          allowedStrategies: [
            AuthenticationStrategy.MFA_COOKIE,
            AuthenticationStrategy.PHONE_CODE,
            AuthenticationStrategy.PHONE_OTP,
            AuthenticationStrategy.RDC_PUSH_NOTIFICATION,
            AuthenticationStrategy.SESSION_OTP,
            AuthenticationStrategy.TIME_BASED_OTP,
          ],
          recommendedMethods: [],
          requiredLevel: 1,
          requiredMethods: [],
        }),
      ),
    ).toStrictEqual([
      {
        identifierHint: "none",
        identifierType: "none",
        method: "mfa_cookie",
        rank: 1,
        recommended: false,
        required: false,
        strategies: ["mfa_cookie"],
      },
      {
        identifierHint: "none",
        identifierType: "none",
        method: "device_link",
        rank: 2,
        recommended: false,
        required: false,
        strategies: ["rdc_push_notification"],
      },
      {
        identifierHint: "none",
        identifierType: "none",
        method: "totp",
        rank: 3,
        recommended: false,
        required: false,
        strategies: ["time_based_otp"],
      },
      {
        identifierHint: "none",
        identifierType: "none",
        method: "session_link",
        rank: 4,
        recommended: false,
        required: false,
        strategies: ["session_otp"],
      },
      {
        identifierHint: "phone",
        identifierType: "phone",
        method: "phone",
        rank: 5,
        recommended: false,
        required: false,
        strategies: ["phone_otp", "phone_otp"],
      },
    ]);
  });

  test("should calculate based on recommended methods", () => {
    expect(
      generateClientConfig(
        createTestAuthenticationSession({
          allowedStrategies: Object.values(AuthenticationStrategy),
          recommendedMethods: [AuthenticationMethod.PASSWORD, AuthenticationMethod.EMAIL],
          requiredLevel: 1,
          requiredMethods: [],
        }),
      ),
    ).toStrictEqual([
      {
        identifierHint: "none",
        identifierType: "none",
        method: "mfa_cookie",
        rank: 1,
        recommended: false,
        required: false,
        strategies: ["mfa_cookie"],
      },
      {
        identifierHint: "email",
        identifierType: "email",
        method: "email",
        rank: 2,
        recommended: true,
        required: false,
        strategies: ["email_otp", "email_code"],
      },
      {
        identifierHint: "none",
        identifierType: "username",
        method: "password",
        rank: 3,
        recommended: true,
        required: false,
        strategies: ["password_browser_link", "password", "recovery_code"],
      },
      {
        identifierHint: "none",
        identifierType: "none",
        method: "device_link",
        rank: 4,
        recommended: false,
        required: false,
        strategies: ["rdc_push_notification", "device_challenge"],
      },
      {
        identifierHint: "none",
        identifierType: "none",
        method: "totp",
        rank: 5,
        recommended: false,
        required: false,
        strategies: ["time_based_otp"],
      },
      {
        identifierHint: "none",
        identifierType: "none",
        method: "session_link",
        rank: 6,
        recommended: false,
        required: false,
        strategies: ["session_otp", "session_accept_with_code"],
      },
      {
        identifierHint: "phone",
        identifierType: "phone",
        method: "phone",
        rank: 7,
        recommended: false,
        required: false,
        strategies: ["phone_otp", "phone_otp"],
      },
    ]);
  });

  test("should calculate based on required methods", () => {
    expect(
      generateClientConfig(
        createTestAuthenticationSession({
          allowedStrategies: Object.values(AuthenticationStrategy),
          recommendedMethods: [],
          requiredLevel: 1,
          requiredMethods: [AuthenticationMethod.PASSWORD, AuthenticationMethod.EMAIL],
        }),
      ),
    ).toStrictEqual([
      {
        identifierHint: "email",
        identifierType: "email",
        method: "email",
        rank: 1,
        recommended: false,
        required: true,
        strategies: ["email_otp", "email_code"],
      },
      {
        identifierHint: "none",
        identifierType: "username",
        method: "password",
        rank: 2,
        recommended: false,
        required: true,
        strategies: ["password_browser_link", "password", "recovery_code"],
      },
      {
        identifierHint: "none",
        identifierType: "none",
        method: "mfa_cookie",
        rank: 3,
        recommended: false,
        required: false,
        strategies: ["mfa_cookie"],
      },
      {
        identifierHint: "none",
        identifierType: "none",
        method: "device_link",
        rank: 4,
        recommended: false,
        required: false,
        strategies: ["rdc_push_notification", "device_challenge"],
      },
      {
        identifierHint: "none",
        identifierType: "none",
        method: "totp",
        rank: 5,
        recommended: false,
        required: false,
        strategies: ["time_based_otp"],
      },
      {
        identifierHint: "none",
        identifierType: "none",
        method: "session_link",
        rank: 6,
        recommended: false,
        required: false,
        strategies: ["session_otp", "session_accept_with_code"],
      },
      {
        identifierHint: "phone",
        identifierType: "phone",
        method: "phone",
        rank: 7,
        recommended: false,
        required: false,
        strategies: ["phone_otp", "phone_otp"],
      },
    ]);
  });
});
