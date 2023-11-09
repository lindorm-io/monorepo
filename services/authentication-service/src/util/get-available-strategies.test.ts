import { AuthenticationStrategy } from "@lindorm-io/common-enums";
import { createTestAuthenticationSession } from "../fixtures/entity";
import { getAvailableStrategies } from "./get-available-strategies";

describe("getAvailableStrategies", () => {
  test("should resolve primary", () => {
    expect(
      getAvailableStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [],
        }),
      ),
    ).toStrictEqual([
      "urn:lindorm:auth:strategy:device-challenge",
      "urn:lindorm:auth:strategy:email-code",
      "urn:lindorm:auth:strategy:email-otp",
      "urn:lindorm:auth:strategy:password-browser-link",
      "urn:lindorm:auth:strategy:password",
      "urn:lindorm:auth:strategy:phone-code",
      "urn:lindorm:auth:strategy:phone-otp",
      "urn:lindorm:auth:strategy:rdc-qr-code",
      "urn:lindorm:auth:strategy:session-display-code",
      "urn:lindorm:auth:strategy:session-qr-code",
    ]);
  });

  test("should resolve secondary", () => {
    expect(
      getAvailableStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.PASSWORD],
        }),
      ),
    ).toStrictEqual([
      "urn:lindorm:auth:strategy:email-code",
      "urn:lindorm:auth:strategy:email-otp",
      "urn:lindorm:auth:strategy:mfa-cookie",
      "urn:lindorm:auth:strategy:phone-code",
      "urn:lindorm:auth:strategy:phone-otp",
      "urn:lindorm:auth:strategy:rdc-push-notification",
      "urn:lindorm:auth:strategy:recovery-code",
      "urn:lindorm:auth:strategy:session-display-code",
      "urn:lindorm:auth:strategy:session-otp",
      "urn:lindorm:auth:strategy:time-based-otp",
    ]);
  });

  test("should filter out used methods", () => {
    expect(
      getAvailableStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.EMAIL_OTP],
        }),
      ),
    ).toStrictEqual([
      "urn:lindorm:auth:strategy:mfa-cookie",
      "urn:lindorm:auth:strategy:phone-code",
      "urn:lindorm:auth:strategy:phone-otp",
      "urn:lindorm:auth:strategy:rdc-push-notification",
      "urn:lindorm:auth:strategy:recovery-code",
      "urn:lindorm:auth:strategy:session-display-code",
      "urn:lindorm:auth:strategy:session-otp",
      "urn:lindorm:auth:strategy:time-based-otp",
    ]);
  });
});
