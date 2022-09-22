import { AuthenticationMethod } from "../common";
import { AuthenticationStrategy } from "../enum";
import { createTestAuthenticationSession } from "../fixtures/entity";
import { generateClientConfig } from "./generate-client-config";

describe("calculateMethodsAndStrategies", () => {
  test("should calculate first factor values", () => {
    expect(
      generateClientConfig(
        createTestAuthenticationSession({
          allowedStrategies: [
            AuthenticationStrategy.BANK_ID_SE,
            AuthenticationStrategy.DEVICE_CHALLENGE,
            AuthenticationStrategy.EMAIL_LINK,
            AuthenticationStrategy.EMAIL_OTP,
            AuthenticationStrategy.PASSWORD,
            AuthenticationStrategy.PASSWORD_BROWSER_LINK,
            AuthenticationStrategy.RDC_QR_CODE,
            AuthenticationStrategy.SESSION_ACCEPT_WITH_CODE,
            AuthenticationStrategy.WEBAUTHN,
          ],
          requestedMethods: [],
        }),
      ),
    ).toMatchSnapshot();
  });

  test("should calculate second factor values", () => {
    expect(
      generateClientConfig(
        createTestAuthenticationSession({
          allowedStrategies: [
            AuthenticationStrategy.MFA_COOKIE,
            AuthenticationStrategy.PHONE_OTP,
            AuthenticationStrategy.RDC_PUSH_NOTIFICATION,
            AuthenticationStrategy.SESSION_OTP,
            AuthenticationStrategy.TIME_BASED_OTP,
          ],
          requestedMethods: [],
        }),
      ),
    ).toMatchSnapshot();
  });

  test("should calculate based on requested methods", () => {
    expect(
      generateClientConfig(
        createTestAuthenticationSession({
          allowedStrategies: Object.values(AuthenticationStrategy),
          requestedMethods: [AuthenticationMethod.PASSWORD, AuthenticationMethod.EMAIL],
        }),
      ),
    ).toMatchSnapshot();
  });
});
