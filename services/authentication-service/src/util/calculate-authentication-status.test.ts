import { calculateAuthenticationStatus } from "./calculate-authentication-status";
import { createTestAuthenticationSession } from "../fixtures/entity";
import { AuthenticationMethod, AuthenticationStrategy } from "@lindorm-io/common-types";

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
          confirmedStrategies: [AuthenticationStrategy.EMAIL_OTP],
          requiredMethods: [AuthenticationMethod.PHONE],
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
          confirmedStrategies: [AuthenticationStrategy.EMAIL_OTP],
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
          confirmedStrategies: [AuthenticationStrategy.EMAIL_OTP],
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
          confirmedStrategies: [AuthenticationStrategy.EMAIL_OTP, AuthenticationStrategy.PASSWORD],
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
          confirmedStrategies: [AuthenticationStrategy.EMAIL_OTP],
          requiredMethods: [],
          minimumLevel: 2,
          recommendedLevel: 2,
          requiredLevel: 2,
        }),
      ),
    ).toBe("confirmed");
  });
});
