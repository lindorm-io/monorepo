import { AuthenticationStrategy } from "@lindorm-io/common-enums";
import { createTestAuthenticationSession } from "../fixtures/entity";
import { getMethodsFromStrategies } from "./get-methods-from-strategies";

describe("getMethodsFromStrategies", () => {
  // TODO enable when bankid is implemented
  test.failing("should resolve bank_id_se", () => {
    expect(
      getMethodsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.BANK_ID_SE],
        }),
      ),
    ).toStrictEqual(["urn:lindorm:auth:method:bank-id-se"]);
  });

  test("should resolve device_link", () => {
    expect(
      getMethodsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.DEVICE_CHALLENGE],
        }),
      ),
    ).toStrictEqual(["urn:lindorm:auth:method:device-link"]);
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
    ).toStrictEqual(["urn:lindorm:auth:method:email"]);
  });

  test("should resolve mfa_cookie", () => {
    expect(
      getMethodsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.MFA_COOKIE],
        }),
      ),
    ).toStrictEqual(["urn:lindorm:auth:method:mfa-cookie"]);
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
    ).toStrictEqual(["urn:lindorm:auth:method:password"]);
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
    ).toStrictEqual(["urn:lindorm:auth:method:phone"]);
  });

  test("should resolve recovery", () => {
    expect(
      getMethodsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.RECOVERY_CODE],
        }),
      ),
    ).toStrictEqual(["urn:lindorm:auth:method:recovery"]);
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
    ).toStrictEqual(["urn:lindorm:auth:method:session-link"]);
  });

  test("should resolve time_based_otp", () => {
    expect(
      getMethodsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.TIME_BASED_OTP],
        }),
      ),
    ).toStrictEqual(["urn:lindorm:auth:method:totp"]);
  });

  // TODO enable when webauthn is implemented
  test.failing("should resolve webauthn", () => {
    expect(
      getMethodsFromStrategies(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.WEBAUTHN],
        }),
      ),
    ).toStrictEqual(["urn:lindorm:auth:method:webauthn"]);
  });
});
