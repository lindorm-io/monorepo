import { AuthenticationMethod, AuthenticationStrategy } from "@lindorm-io/common-types";
import { createTestAuthenticationSession } from "../fixtures/entity";
import { generateClientConfig } from "./generate-client-config";

describe("calculateMethodsAndStrategies", () => {
  test("should resolve client config", () => {
    expect(
      generateClientConfig(
        createTestAuthenticationSession({
          allowedStrategies: Object.values(AuthenticationStrategy),
          idTokenMethods: [],
          requiredLevelOfAssurance: 1,
          requiredMethods: [],
        }),
      ),
    ).toStrictEqual([
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:device-link",
        rank: 1,
        recommended: false,
        required: true,
        strategies: [
          {
            strategy: "urn:lindorm:auth:strategy:device-challenge",
            weight: 9000,
          },
          {
            strategy: "urn:lindorm:auth:strategy:rdc-push-notification",
            weight: 90,
          },
          {
            strategy: "urn:lindorm:auth:strategy:rdc-qr-code",
            weight: 90,
          },
        ],
        weight: 9000,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:mfa-cookie",
        rank: 2,
        recommended: false,
        required: false,
        strategies: [
          {
            strategy: "urn:lindorm:auth:strategy:mfa-cookie",
            weight: 999,
          },
        ],
        weight: 999,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:totp",
        rank: 3,
        recommended: false,
        required: false,
        strategies: [
          {
            strategy: "urn:lindorm:auth:strategy:time-based-otp",
            weight: 90,
          },
        ],
        weight: 90,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:session-link",
        rank: 4,
        recommended: false,
        required: false,
        strategies: [
          {
            strategy: "urn:lindorm:auth:strategy:session-otp",
            weight: 80,
          },
          {
            strategy: "urn:lindorm:auth:strategy:session-qr-code",
            weight: 80,
          },
          {
            strategy: "urn:lindorm:auth:strategy:session-display-code",
            weight: 80,
          },
        ],
        weight: 80,
      },
      {
        hint: "test@lindorm.io",
        hintType: "email",
        identifierType: "email",
        method: "urn:lindorm:auth:method:email",
        rank: 5,
        recommended: false,
        required: false,
        strategies: [
          {
            strategy: "urn:lindorm:auth:strategy:email-otp",
            weight: 30,
          },
          {
            strategy: "urn:lindorm:auth:strategy:email-code",
            weight: 10,
          },
        ],
        weight: 30,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "username",
        method: "urn:lindorm:auth:method:password",
        rank: 6,
        recommended: false,
        required: false,
        strategies: [
          {
            strategy: "urn:lindorm:auth:strategy:password-browser-link",
            weight: 20,
          },
          {
            strategy: "urn:lindorm:auth:strategy:password",
            weight: 10,
          },
        ],
        weight: 20,
      },
      {
        hint: "0701234567",
        hintType: "phone",
        identifierType: "phone",
        method: "urn:lindorm:auth:method:phone",
        rank: 7,
        recommended: false,
        required: false,
        strategies: [
          {
            strategy: "urn:lindorm:auth:strategy:phone-otp",
            weight: 20,
          },
          {
            strategy: "urn:lindorm:auth:strategy:phone-code",
            weight: 10,
          },
        ],
        weight: 20,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:recovery",
        rank: 8,
        recommended: false,
        required: false,
        strategies: [
          {
            strategy: "urn:lindorm:auth:strategy:recovery-code",
            weight: 0,
          },
        ],
        weight: 0,
      },
    ]);
  });

  test("should calculate based on recommended methods", () => {
    expect(
      generateClientConfig(
        createTestAuthenticationSession({
          allowedStrategies: Object.values(AuthenticationStrategy),
          idTokenMethods: [AuthenticationMethod.PASSWORD, AuthenticationMethod.EMAIL],
          requiredLevelOfAssurance: 1,
          requiredMethods: [],
          requiredStrategies: [],
        }),
      ),
    ).toStrictEqual([
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:mfa-cookie",
        rank: 1,
        recommended: false,
        required: false,
        strategies: [{ strategy: "urn:lindorm:auth:strategy:mfa-cookie", weight: 999 }],
        weight: 999,
      },
      {
        hint: "test@lindorm.io",
        hintType: "email",
        identifierType: "email",
        method: "urn:lindorm:auth:method:email",
        rank: 2,
        recommended: true,
        required: false,
        strategies: [
          { strategy: "urn:lindorm:auth:strategy:email-otp", weight: 750 },
          { strategy: "urn:lindorm:auth:strategy:email-code", weight: 250 },
        ],
        weight: 750,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "username",
        method: "urn:lindorm:auth:method:password",
        rank: 3,
        recommended: true,
        required: false,
        strategies: [
          { strategy: "urn:lindorm:auth:strategy:password-browser-link", weight: 500 },
          { strategy: "urn:lindorm:auth:strategy:password", weight: 250 },
        ],
        weight: 500,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:device-link",
        rank: 4,
        recommended: false,
        required: false,
        strategies: [
          { strategy: "urn:lindorm:auth:strategy:rdc-push-notification", weight: 90 },
          { strategy: "urn:lindorm:auth:strategy:rdc-qr-code", weight: 90 },
          { strategy: "urn:lindorm:auth:strategy:device-challenge", weight: 90 },
        ],
        weight: 90,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:totp",
        rank: 5,
        recommended: false,
        required: false,
        strategies: [{ strategy: "urn:lindorm:auth:strategy:time-based-otp", weight: 90 }],
        weight: 90,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:session-link",
        rank: 6,
        recommended: false,
        required: false,
        strategies: [
          { strategy: "urn:lindorm:auth:strategy:session-otp", weight: 80 },
          { strategy: "urn:lindorm:auth:strategy:session-qr-code", weight: 80 },
          { strategy: "urn:lindorm:auth:strategy:session-display-code", weight: 80 },
        ],
        weight: 80,
      },
      {
        hint: "0701234567",
        hintType: "phone",
        identifierType: "phone",
        method: "urn:lindorm:auth:method:phone",
        rank: 7,
        recommended: false,
        required: false,
        strategies: [
          { strategy: "urn:lindorm:auth:strategy:phone-otp", weight: 20 },
          { strategy: "urn:lindorm:auth:strategy:phone-code", weight: 10 },
        ],
        weight: 20,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:recovery",
        rank: 8,
        recommended: false,
        required: false,
        strategies: [{ strategy: "urn:lindorm:auth:strategy:recovery-code", weight: 0 }],
        weight: 0,
      },
    ]);
  });

  test("should calculate based on required methods", () => {
    expect(
      generateClientConfig(
        createTestAuthenticationSession({
          allowedStrategies: Object.values(AuthenticationStrategy),
          idTokenMethods: [],
          requiredLevelOfAssurance: 1,
          requiredMethods: [AuthenticationMethod.PASSWORD, AuthenticationMethod.EMAIL],
          requiredStrategies: [],
        }),
      ),
    ).toStrictEqual([
      {
        hint: "test@lindorm.io",
        hintType: "email",
        identifierType: "email",
        method: "urn:lindorm:auth:method:email",
        rank: 1,
        recommended: false,
        required: true,
        strategies: [
          { strategy: "urn:lindorm:auth:strategy:email-otp", weight: 3000 },
          { strategy: "urn:lindorm:auth:strategy:email-code", weight: 1000 },
        ],
        weight: 3000,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "username",
        method: "urn:lindorm:auth:method:password",
        rank: 2,
        recommended: false,
        required: true,
        strategies: [
          { strategy: "urn:lindorm:auth:strategy:password-browser-link", weight: 2000 },
          { strategy: "urn:lindorm:auth:strategy:password", weight: 1000 },
        ],
        weight: 2000,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:mfa-cookie",
        rank: 3,
        recommended: false,
        required: false,
        strategies: [{ strategy: "urn:lindorm:auth:strategy:mfa-cookie", weight: 999 }],
        weight: 999,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:device-link",
        rank: 4,
        recommended: false,
        required: false,
        strategies: [
          { strategy: "urn:lindorm:auth:strategy:rdc-push-notification", weight: 90 },
          { strategy: "urn:lindorm:auth:strategy:rdc-qr-code", weight: 90 },
          { strategy: "urn:lindorm:auth:strategy:device-challenge", weight: 90 },
        ],
        weight: 90,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:totp",
        rank: 5,
        recommended: false,
        required: false,
        strategies: [{ strategy: "urn:lindorm:auth:strategy:time-based-otp", weight: 90 }],
        weight: 90,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:session-link",
        rank: 6,
        recommended: false,
        required: false,
        strategies: [
          { strategy: "urn:lindorm:auth:strategy:session-otp", weight: 80 },
          { strategy: "urn:lindorm:auth:strategy:session-qr-code", weight: 80 },
          { strategy: "urn:lindorm:auth:strategy:session-display-code", weight: 80 },
        ],
        weight: 80,
      },
      {
        hint: "0701234567",
        hintType: "phone",
        identifierType: "phone",
        method: "urn:lindorm:auth:method:phone",
        rank: 7,
        recommended: false,
        required: false,
        strategies: [
          { strategy: "urn:lindorm:auth:strategy:phone-otp", weight: 20 },
          { strategy: "urn:lindorm:auth:strategy:phone-code", weight: 10 },
        ],
        weight: 20,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:recovery",
        rank: 8,
        recommended: false,
        required: false,
        strategies: [{ strategy: "urn:lindorm:auth:strategy:recovery-code", weight: 0 }],
        weight: 0,
      },
    ]);
  });

  test("should calculate based on required strategies", () => {
    expect(
      generateClientConfig(
        createTestAuthenticationSession({
          allowedStrategies: Object.values(AuthenticationStrategy),
          idTokenMethods: [],
          requiredLevelOfAssurance: 1,
          requiredMethods: [],
          requiredStrategies: [AuthenticationStrategy.EMAIL_CODE, AuthenticationStrategy.PASSWORD],
        }),
      ),
    ).toStrictEqual([
      {
        hint: "test@lindorm.io",
        hintType: "email",
        identifierType: "username",
        method: "urn:lindorm:auth:method:password",
        rank: 1,
        recommended: false,
        required: true,
        strategies: [
          { strategy: "urn:lindorm:auth:strategy:password", weight: 1000 },
          { strategy: "urn:lindorm:auth:strategy:password-browser-link", weight: 20 },
        ],
        weight: 1000,
      },
      {
        hint: "test@lindorm.io",
        hintType: "email",
        identifierType: "email",
        method: "urn:lindorm:auth:method:email",
        rank: 2,
        recommended: false,
        required: true,
        strategies: [
          { strategy: "urn:lindorm:auth:strategy:email-code", weight: 1000 },
          { strategy: "urn:lindorm:auth:strategy:email-otp", weight: 30 },
        ],
        weight: 1000,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:mfa-cookie",
        rank: 3,
        recommended: false,
        required: false,
        strategies: [{ strategy: "urn:lindorm:auth:strategy:mfa-cookie", weight: 999 }],
        weight: 999,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:device-link",
        rank: 4,
        recommended: false,
        required: false,
        strategies: [
          { strategy: "urn:lindorm:auth:strategy:rdc-push-notification", weight: 90 },
          { strategy: "urn:lindorm:auth:strategy:rdc-qr-code", weight: 90 },
          { strategy: "urn:lindorm:auth:strategy:device-challenge", weight: 90 },
        ],
        weight: 90,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:totp",
        rank: 5,
        recommended: false,
        required: false,
        strategies: [{ strategy: "urn:lindorm:auth:strategy:time-based-otp", weight: 90 }],
        weight: 90,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:session-link",
        rank: 6,
        recommended: false,
        required: false,
        strategies: [
          { strategy: "urn:lindorm:auth:strategy:session-otp", weight: 80 },
          { strategy: "urn:lindorm:auth:strategy:session-qr-code", weight: 80 },
          { strategy: "urn:lindorm:auth:strategy:session-display-code", weight: 80 },
        ],
        weight: 80,
      },
      {
        hint: "0701234567",
        hintType: "phone",
        identifierType: "phone",
        method: "urn:lindorm:auth:method:phone",
        rank: 7,
        recommended: false,
        required: false,
        strategies: [
          { strategy: "urn:lindorm:auth:strategy:phone-otp", weight: 20 },
          { strategy: "urn:lindorm:auth:strategy:phone-code", weight: 10 },
        ],
        weight: 20,
      },
      {
        hint: null,
        hintType: "none",
        identifierType: "none",
        method: "urn:lindorm:auth:method:recovery",
        rank: 8,
        recommended: false,
        required: false,
        strategies: [{ strategy: "urn:lindorm:auth:strategy:recovery-code", weight: 0 }],
        weight: 0,
      },
    ]);
  });
});
