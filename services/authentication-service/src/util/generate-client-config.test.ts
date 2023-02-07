import { createTestAuthenticationSession } from "../fixtures/entity";
import { generateClientConfig } from "./generate-client-config";
import { AuthenticationStrategies } from "@lindorm-io/common-types";

describe("calculateMethodsAndStrategies", () => {
  test("should calculate first factor values", () => {
    expect(
      generateClientConfig(
        createTestAuthenticationSession({
          allowedStrategies: [
            "bank_id_se",
            "device_challenge",
            "email_link",
            "email_otp",
            "password",
            "password_browser_link",
            "rdc_qr_code",
            "session_accept_with_code",
            "webauthn",
          ],
          recommendedMethods: [],
          requiredLevel: 1,
          requiredMethods: [],
        }),
      ),
    ).toMatchSnapshot();
  });

  test("should calculate second factor values", () => {
    expect(
      generateClientConfig(
        createTestAuthenticationSession({
          allowedStrategies: [
            "mfa_cookie",
            "phone_otp",
            "rdc_push_notification",
            "session_otp",
            "time_based_otp",
          ],
          recommendedMethods: [],
          requiredLevel: 1,
          requiredMethods: [],
        }),
      ),
    ).toMatchSnapshot();
  });

  test("should calculate based on recommended methods", () => {
    expect(
      generateClientConfig(
        createTestAuthenticationSession({
          allowedStrategies: Object.values(AuthenticationStrategies),
          recommendedMethods: ["password", "email"],
          requiredLevel: 1,
          requiredMethods: [],
        }),
      ),
    ).toMatchSnapshot();
  });

  test("should calculate based on requested methods", () => {
    expect(
      generateClientConfig(
        createTestAuthenticationSession({
          allowedStrategies: Object.values(AuthenticationStrategies),
          recommendedMethods: [],
          requiredLevel: 1,
          requiredMethods: ["password", "email"],
        }),
      ),
    ).toMatchSnapshot();
  });
});
