import { calculateAuthenticationStatus } from "./calculate-authentication-status";
import { createTestAuthenticationSession } from "../fixtures/entity";

describe("calculateAuthenticationStatus", () => {
  test("should resolve pending on identity", () => {
    expect(
      calculateAuthenticationStatus(
        createTestAuthenticationSession({
          identityId: null,
          minimumLevel: 1,
          recommendedLevel: 4,
          requiredLevel: 1,
        }),
      ),
    );
  });

  test("should resolve pending on requested methods", () => {
    expect(
      calculateAuthenticationStatus(
        createTestAuthenticationSession({
          confirmedStrategies: ["email_otp"],
          requiredMethods: ["phone"],
          minimumLevel: 1,
          recommendedLevel: 4,
          requiredLevel: 1,
        }),
      ),
    ).toBe("pending");
  });

  test("should resolve pending on minimum level", () => {
    expect(
      calculateAuthenticationStatus(
        createTestAuthenticationSession({
          confirmedStrategies: ["email_otp"],
          requiredMethods: [],
          minimumLevel: 4,
          recommendedLevel: 4,
          requiredLevel: 1,
        }),
      ),
    ).toBe("pending");
  });

  test("should resolve pending on requested level", () => {
    expect(
      calculateAuthenticationStatus(
        createTestAuthenticationSession({
          confirmedStrategies: ["email_otp"],
          requiredMethods: [],
          minimumLevel: 1,
          recommendedLevel: 4,
          requiredLevel: 4,
        }),
      ),
    ).toBe("pending");
  });

  test("should resolve confirmed on methods", () => {
    expect(
      calculateAuthenticationStatus(
        createTestAuthenticationSession({
          confirmedStrategies: ["email_otp", "password"],
          requiredMethods: [],
          minimumLevel: 1,
          recommendedLevel: 4,
          requiredLevel: 1,
        }),
      ),
    ).toBe("confirmed");
  });

  test("should resolve confirmed on level", () => {
    expect(
      calculateAuthenticationStatus(
        createTestAuthenticationSession({
          confirmedStrategies: ["email_otp"],
          requiredMethods: [],
          minimumLevel: 2,
          recommendedLevel: 2,
          requiredLevel: 2,
        }),
      ),
    ).toBe("confirmed");
  });
});
