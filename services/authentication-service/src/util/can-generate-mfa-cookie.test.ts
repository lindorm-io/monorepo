import { canGenerateMfaCookie } from "./can-generate-mfa-cookie";
import { createTestAuthenticationSession } from "../fixtures/entity";

describe("canFlowGenerateMfaCookie", () => {
  test("should resolve true", () => {
    expect(
      canGenerateMfaCookie(
        createTestAuthenticationSession({
          confirmedStrategies: ["email_otp", "session_otp"],
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
          confirmedStrategies: ["email_otp"],
        }),
      ),
    ).toBe(false);
  });
});
