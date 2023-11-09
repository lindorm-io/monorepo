import { AuthenticationStrategy } from "@lindorm-io/common-enums";
import { createTestAuthenticationSession } from "../fixtures/entity";
import { getFactorsFromStrategies } from "./get-factors-from-strategies";

describe("getFactorsFromStrategies", () => {
  // TODO enable when bankid is implemented
  test.failing("should resolve for bank_id_se", () => {
    expect(
      getFactorsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.BANK_ID_SE],
        }),
      ),
    ).toStrictEqual([""]);
  });

  test("should resolve for device_link", () => {
    expect(
      getFactorsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.DEVICE_CHALLENGE],
        }),
      ),
    ).toStrictEqual(["urn:lindorm:auth:acr:phrh"]);
  });

  test("should resolve for email", () => {
    expect(
      getFactorsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [
            AuthenticationStrategy.EMAIL_CODE,
            AuthenticationStrategy.EMAIL_OTP,
          ],
        }),
      ),
    ).toStrictEqual(["urn:lindorm:auth:acr:1fa"]);
  });

  test("should resolve for mfa_cookie", () => {
    expect(
      getFactorsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.MFA_COOKIE],
        }),
      ),
    ).toStrictEqual(["urn:lindorm:auth:acr:1fa"]);
  });

  test("should resolve for password", () => {
    expect(
      getFactorsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [
            AuthenticationStrategy.PASSWORD,
            AuthenticationStrategy.PASSWORD_BROWSER_LINK,
          ],
        }),
      ),
    ).toStrictEqual(["urn:lindorm:auth:acr:1fa"]);
  });

  test("should resolve for phone", () => {
    expect(
      getFactorsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [
            AuthenticationStrategy.PHONE_CODE,
            AuthenticationStrategy.PHONE_OTP,
          ],
        }),
      ),
    ).toStrictEqual(["urn:lindorm:auth:acr:1fa"]);
  });

  test("should resolve for recovery", () => {
    expect(
      getFactorsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.RECOVERY_CODE],
        }),
      ),
    ).toStrictEqual(["urn:lindorm:auth:acr:1fa"]);
  });

  test("should resolve for session_link", () => {
    expect(
      getFactorsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [
            AuthenticationStrategy.SESSION_DISPLAY_CODE,
            AuthenticationStrategy.SESSION_OTP,
            AuthenticationStrategy.SESSION_QR_CODE,
          ],
        }),
      ),
    ).toStrictEqual(["urn:lindorm:auth:acr:1fa"]);
  });

  test("should resolve for time_based_otp", () => {
    expect(
      getFactorsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.TIME_BASED_OTP],
        }),
      ),
    ).toStrictEqual(["urn:lindorm:auth:acr:phr"]);
  });

  // TODO enable when webauthn is implemented
  test.failing("should resolve for webauthn", () => {
    expect(
      getFactorsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.WEBAUTHN],
        }),
      ),
    ).toStrictEqual([""]);
  });
});
