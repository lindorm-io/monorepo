import { AuthenticationStrategy } from "@lindorm-io/common-types";
import { createTestAuthenticationSession } from "../fixtures/entity";
import { getMethodsFromStrategies } from "./get-methods-from-strategies";

describe("getMethodsFromStrategies", () => {
  test.failing("should resolve bank_id_se", () => {
    expect(
      getMethodsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.BANK_ID_SE],
        }),
      ),
    ).toStrictEqual(["bank_id_se"]);
  });

  test("should resolve device_link", () => {
    expect(
      getMethodsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.DEVICE_CHALLENGE],
        }),
      ),
    ).toStrictEqual(["device_link"]);
  });

  test("should resolve email", () => {
    expect(
      getMethodsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [
            AuthenticationStrategy.EMAIL_CODE,
            AuthenticationStrategy.EMAIL_OTP,
          ],
        }),
      ),
    ).toStrictEqual(["email"]);
  });

  test("should resolve mfa_cookie", () => {
    expect(
      getMethodsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.MFA_COOKIE],
        }),
      ),
    ).toStrictEqual(["mfa_cookie"]);
  });

  test("should resolve password", () => {
    expect(
      getMethodsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [
            AuthenticationStrategy.PASSWORD,
            AuthenticationStrategy.PASSWORD_BROWSER_LINK,
          ],
        }),
      ),
    ).toStrictEqual(["password"]);
  });

  test("should resolve phone", () => {
    expect(
      getMethodsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [
            AuthenticationStrategy.PHONE_CODE,
            AuthenticationStrategy.PHONE_OTP,
          ],
        }),
      ),
    ).toStrictEqual(["phone"]);
  });

  test("should resolve recovery", () => {
    expect(
      getMethodsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.RECOVERY_CODE],
        }),
      ),
    ).toStrictEqual(["recovery"]);
  });

  test("should resolve session_link", () => {
    expect(
      getMethodsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [
            AuthenticationStrategy.SESSION_DISPLAY_CODE,
            AuthenticationStrategy.SESSION_OTP,
            AuthenticationStrategy.SESSION_QR_CODE,
          ],
        }),
      ),
    ).toStrictEqual(["session_link"]);
  });

  test("should resolve time_based_otp", () => {
    expect(
      getMethodsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.TIME_BASED_OTP],
        }),
      ),
    ).toStrictEqual(["time_based_otp"]);
  });

  test.failing("should resolve webauthn", () => {
    expect(
      getMethodsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.WEBAUTHN],
        }),
      ),
    ).toStrictEqual(["webauthn"]);
  });
});
