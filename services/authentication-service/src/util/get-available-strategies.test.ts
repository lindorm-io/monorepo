import { getAvailableStrategies } from "./get-available-strategies";
import { createTestAuthenticationSession } from "../fixtures/entity";
import { AuthenticationStrategy } from "@lindorm-io/common-types";

describe("getAvailableStrategies", () => {
  test("should resolve primary", () => {
    expect(
      getAvailableStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [],
        }),
      ),
    ).toStrictEqual([
      "device_challenge",
      "email_code",
      "email_otp",
      "password_browser_link",
      "password",
      "phone_code",
      "phone_otp",
      "rdc_qr_code",
      "session_display_code",
      "session_qr_code",
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
      "email_code",
      "email_otp",
      "mfa_cookie",
      "phone_code",
      "phone_otp",
      "rdc_push_notification",
      "recovery_code",
      "session_display_code",
      "session_otp",
      "time_based_otp",
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
      "mfa_cookie",
      "phone_code",
      "phone_otp",
      "rdc_push_notification",
      "recovery_code",
      "session_display_code",
      "session_otp",
      "time_based_otp",
    ]);
  });
});
