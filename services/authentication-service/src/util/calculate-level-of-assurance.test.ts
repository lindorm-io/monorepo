import { calculateLevelOfAssurance } from "./calculate-level-of-assurance";
import { createTestLoginSession } from "../fixtures/entity";
import { FlowType } from "../enum";

describe("calculateLevelOfAssurance", () => {
  test("should resolve with max value", () => {
    expect(
      calculateLevelOfAssurance(
        createTestLoginSession({
          amrValues: [FlowType.EMAIL_OTP, FlowType.PHONE_OTP, FlowType.MFA_COOKIE],
        }),
      ),
    ).toBe(3);
  });

  test("should resolve with value for EMAIL_OTP", () => {
    expect(
      calculateLevelOfAssurance(
        createTestLoginSession({
          amrValues: [FlowType.EMAIL_OTP],
        }),
      ),
    ).toBe(2);
  });

  test("should resolve with value for BANK_ID_SE", () => {
    expect(
      calculateLevelOfAssurance(
        createTestLoginSession({
          amrValues: [FlowType.BANK_ID_SE],
        }),
      ),
    ).toBe(4);
  });

  test("should resolve with value for oidc_apple", () => {
    expect(
      calculateLevelOfAssurance(
        createTestLoginSession({
          amrValues: ["oidc_apple"],
        }),
      ),
    ).toBe(3);
  });

  test("should resolve with value for oidc_google", () => {
    expect(
      calculateLevelOfAssurance(
        createTestLoginSession({
          amrValues: ["oidc_google"],
        }),
      ),
    ).toBe(2);
  });
});
