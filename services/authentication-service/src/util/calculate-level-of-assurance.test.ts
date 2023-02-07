import { calculateLevelOfAssurance } from "./calculate-level-of-assurance";
import { createTestAuthenticationSession } from "../fixtures/entity";

describe("calculateLevelOfAssurance", () => {
  test("should resolve with max value", () => {
    expect(
      calculateLevelOfAssurance(
        createTestAuthenticationSession({
          confirmedStrategies: ["email_otp", "phone_otp", "mfa_cookie"],
        }),
      ),
    ).toStrictEqual({ level: 3, maximum: 3 });
  });

  test("should resolve with value for EMAIL_OTP", () => {
    expect(
      calculateLevelOfAssurance(
        createTestAuthenticationSession({
          confirmedStrategies: ["email_otp"],
        }),
      ),
    ).toStrictEqual({ level: 2, maximum: 2 });
  });

  test("should resolve with value for BANK_ID_SE", () => {
    expect(
      calculateLevelOfAssurance(
        createTestAuthenticationSession({
          confirmedStrategies: ["bank_id_se"],
        }),
      ),
    ).toStrictEqual({ level: 4, maximum: 4 });
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
          confirmedStrategies: ["mfa_cookie"],
          confirmedOidcLevel: 2,
        }),
      ),
    ).toStrictEqual({ level: 3, maximum: 3 });
  });
});
