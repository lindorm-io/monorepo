import { AuthenticationMethod } from "../enum";
import { calculateLevelOfAssurance } from "./calculate-level-of-assurance";
import { createTestAuthenticationSession } from "../fixtures/entity";

describe("calculateLevelOfAssurance", () => {
  test("should resolve with max value", () => {
    expect(
      calculateLevelOfAssurance(
        createTestAuthenticationSession({
          confirmedMethods: [
            AuthenticationMethod.EMAIL_OTP,
            AuthenticationMethod.PHONE_OTP,
            AuthenticationMethod.MFA_COOKIE,
          ],
        }),
      ),
    ).toStrictEqual({ levelOfAssurance: 3, maximumLevelOfAssurance: 3 });
  });

  test("should resolve with value for EMAIL_OTP", () => {
    expect(
      calculateLevelOfAssurance(
        createTestAuthenticationSession({
          confirmedMethods: [AuthenticationMethod.EMAIL_OTP],
        }),
      ),
    ).toStrictEqual({ levelOfAssurance: 2, maximumLevelOfAssurance: 2 });
  });

  test("should resolve with value for BANK_ID_SE", () => {
    expect(
      calculateLevelOfAssurance(
        createTestAuthenticationSession({
          confirmedMethods: [AuthenticationMethod.BANK_ID_SE],
        }),
      ),
    ).toStrictEqual({ levelOfAssurance: 4, maximumLevelOfAssurance: 4 });
  });
});
