import { canGenerateMfaCookie } from "./can-generate-mfa-cookie";
import { createTestAuthenticationSession } from "../fixtures/entity";
import { AuthenticationStrategy } from "../enum";

describe("canFlowGenerateMfaCookie", () => {
  test("should resolve true", () => {
    expect(
      canGenerateMfaCookie(
        createTestAuthenticationSession({
          confirmedStrategies: [
            AuthenticationStrategy.EMAIL_OTP,
            AuthenticationStrategy.SESSION_OTP,
          ],
        }),
      ),
    ).toBe(true);
  });

  test("should resolve false when amr values are not set", () => {
    expect(
      canGenerateMfaCookie(
        createTestAuthenticationSession({
          confirmedStrategies: [],
        }),
      ),
    ).toBe(false);
  });

  test("should resolve false when amr values are too few", () => {
    expect(
      canGenerateMfaCookie(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.EMAIL_OTP],
        }),
      ),
    ).toBe(false);
  });
});
