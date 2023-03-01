import { calculateLevelOfAssurance } from "./calculate-level-of-assurance";
import { createTestAuthenticationSession } from "../fixtures/entity";
import { AuthenticationStrategy } from "@lindorm-io/common-types";

describe("calculateLevelOfAssurance", () => {
  test("should resolve with max value", () => {
    expect(
      calculateLevelOfAssurance(
        createTestAuthenticationSession({
          confirmedStrategies: [
            AuthenticationStrategy.EMAIL_OTP,
            AuthenticationStrategy.PHONE_OTP,
            AuthenticationStrategy.MFA_COOKIE,
          ],
        }),
      ),
    ).toStrictEqual({ level: 3, maximum: 3 });
  });

  test("should resolve with value for EMAIL_OTP", () => {
    expect(
      calculateLevelOfAssurance(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.EMAIL_OTP],
        }),
      ),
    ).toStrictEqual({ level: 2, maximum: 2 });
  });

  test("should resolve with value for DEVICE_CHALLENGE", () => {
    expect(
      calculateLevelOfAssurance(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.DEVICE_CHALLENGE],
        }),
      ),
    ).toStrictEqual({ level: 3, maximum: 3 });
  });

  test("should resolve with value for OIDC", () => {
    expect(
      calculateLevelOfAssurance(
        createTestAuthenticationSession({
          confirmedStrategies: [],
          confirmedOidcLevel: 4,
        }),
      ),
    ).toStrictEqual({ level: 4, maximum: 4 });
  });

  test("should resolve with mixed values", () => {
    expect(
      calculateLevelOfAssurance(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.MFA_COOKIE],
          confirmedOidcLevel: 2,
        }),
      ),
    ).toStrictEqual({ level: 3, maximum: 3 });
  });
});
