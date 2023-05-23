import { AuthenticationMethod, AuthenticationStrategy } from "@lindorm-io/common-types";
import { createTestAccount, createTestAuthenticationSession } from "../fixtures/entity";
import { calculateAuthenticationStatus } from "./calculate-authentication-status";

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
        createTestAccount({ requireMfa: false }),
      ),
    );
  });

  test("should resolve pending on account", () => {
    expect(
      calculateAuthenticationStatus(
        createTestAuthenticationSession({
          minimumLevel: 1,
          recommendedLevel: 4,
          requiredLevel: 1,
        }),
      ),
    );
  });

  test("should resolve pending on required methods", () => {
    expect(
      calculateAuthenticationStatus(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.EMAIL_OTP],
          requiredMethods: [AuthenticationMethod.PHONE],
          requiredStrategies: [],
          minimumLevel: 1,
          recommendedLevel: 4,
          requiredLevel: 1,
        }),
        createTestAccount({ requireMfa: false }),
      ),
    ).toBe("pending");
  });

  test("should resolve pending on required strategies", () => {
    expect(
      calculateAuthenticationStatus(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.EMAIL_OTP],
          requiredStrategies: [AuthenticationStrategy.PASSWORD],
          minimumLevel: 1,
          recommendedLevel: 4,
          requiredLevel: 1,
        }),
        createTestAccount({ requireMfa: false }),
      ),
    ).toBe("pending");
  });

  test("should resolve pending on minimum level", () => {
    expect(
      calculateAuthenticationStatus(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.EMAIL_OTP],
          requiredMethods: [],
          requiredStrategies: [],
          minimumLevel: 4,
          recommendedLevel: 4,
          requiredLevel: 1,
        }),
        createTestAccount({ requireMfa: false }),
      ),
    ).toBe("pending");
  });

  test("should resolve pending on requested level", () => {
    expect(
      calculateAuthenticationStatus(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.EMAIL_OTP],
          requiredMethods: [],
          requiredStrategies: [],
          minimumLevel: 1,
          recommendedLevel: 4,
          requiredLevel: 4,
        }),
        createTestAccount({ requireMfa: false }),
      ),
    ).toBe("pending");
  });

  test("should resolve pending on account mfa", () => {
    expect(
      calculateAuthenticationStatus(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.EMAIL_OTP],
          requiredMethods: [],
          requiredStrategies: [],
          minimumLevel: 1,
          recommendedLevel: 4,
          requiredLevel: 1,
        }),
        createTestAccount({ requireMfa: true }),
      ),
    ).toBe("pending");
  });

  test("should resolve confirmed on methods", () => {
    expect(
      calculateAuthenticationStatus(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.EMAIL_OTP, AuthenticationStrategy.PASSWORD],
          requiredMethods: [AuthenticationMethod.EMAIL],
          requiredStrategies: [],
          minimumLevel: 1,
          recommendedLevel: 4,
          requiredLevel: 1,
        }),
        createTestAccount({ requireMfa: false }),
      ),
    ).toBe("confirmed");
  });

  test("should resolve confirmed on strategies", () => {
    expect(
      calculateAuthenticationStatus(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.EMAIL_OTP, AuthenticationStrategy.PASSWORD],
          requiredMethods: [],
          requiredStrategies: [AuthenticationStrategy.PASSWORD],
          minimumLevel: 1,
          recommendedLevel: 4,
          requiredLevel: 1,
        }),
        createTestAccount({ requireMfa: false }),
      ),
    ).toBe("confirmed");
  });

  test("should resolve confirmed on level", () => {
    expect(
      calculateAuthenticationStatus(
        createTestAuthenticationSession({
          confirmedStrategies: [AuthenticationStrategy.EMAIL_OTP],
          requiredMethods: [],
          requiredStrategies: [],
          minimumLevel: 2,
          recommendedLevel: 2,
          requiredLevel: 2,
        }),
        createTestAccount({ requireMfa: false }),
      ),
    ).toBe("confirmed");
  });
});
