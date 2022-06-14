import { canGenerateMfaCookie } from "./can-generate-mfa-cookie";
import { createTestAuthenticationSession } from "../fixtures/entity";
import { AuthenticationMethod } from "../enum";

describe("canFlowGenerateMfaCookie", () => {
  test("should resolve true", () => {
    expect(
      canGenerateMfaCookie(
        createTestAuthenticationSession({
          confirmedMethods: [AuthenticationMethod.EMAIL_OTP, AuthenticationMethod.SESSION_OTP],
        }),
      ),
    ).toBe(true);
  });

  test("should resolve false when amr values are not set", () => {
    expect(
      canGenerateMfaCookie(
        createTestAuthenticationSession({
          confirmedMethods: [],
        }),
      ),
    ).toBe(false);
  });

  test("should resolve false when amr values are too few", () => {
    expect(
      canGenerateMfaCookie(
        createTestAuthenticationSession({
          confirmedMethods: [AuthenticationMethod.EMAIL_OTP],
        }),
      ),
    ).toBe(false);
  });
});
