import { calculateAuthenticationStatus } from "./calculate-authentication-status";
import { createTestAuthenticationSession } from "../fixtures/entity";
import { AuthenticationStrategy } from "../enum";
import { AuthenticationMethod, SessionStatus } from "../common";

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
    ).toBe(SessionStatus.PENDING);
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
    ).toBe(SessionStatus.PENDING);
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
    ).toBe(SessionStatus.PENDING);
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
    ).toBe(SessionStatus.CONFIRMED);
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
    ).toBe(SessionStatus.CONFIRMED);
  });
});
