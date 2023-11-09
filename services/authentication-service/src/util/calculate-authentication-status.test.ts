import { AuthenticationMethod, AuthenticationStrategy } from "@lindorm-io/common-enums";
import { createTestAccount, createTestAuthenticationSession } from "../fixtures/entity";
import { calculateAuthenticationStatus } from "./calculate-authentication-status";

describe("calculateAuthenticationStatus", () => {
  test("should resolve pending on identity", () => {
    expect(
      calculateAuthenticationStatus(
        createTestAuthenticationSession({
          identityId: null,
          minimumLevelOfAssurance: 1,
          idTokenLevelOfAssurance: 4,
          requiredLevelOfAssurance: 1,
        }),
        createTestAccount({ requireMfa: false }),
      ),
    );
  });

  test("should resolve pending on account", () => {
    expect(
      calculateAuthenticationStatus(
        createTestAuthenticationSession({
          minimumLevelOfAssurance: 1,
          idTokenLevelOfAssurance: 4,
          requiredLevelOfAssurance: 1,
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
          minimumLevelOfAssurance: 1,
          idTokenLevelOfAssurance: 4,
          requiredLevelOfAssurance: 1,
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
          minimumLevelOfAssurance: 1,
          idTokenLevelOfAssurance: 4,
          requiredLevelOfAssurance: 1,
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
          minimumLevelOfAssurance: 4,
          idTokenLevelOfAssurance: 4,
          requiredLevelOfAssurance: 1,
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
          minimumLevelOfAssurance: 1,
          idTokenLevelOfAssurance: 4,
          requiredLevelOfAssurance: 4,
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
          minimumLevelOfAssurance: 1,
          idTokenLevelOfAssurance: 4,
          requiredLevelOfAssurance: 1,
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
          minimumLevelOfAssurance: 1,
          idTokenLevelOfAssurance: 4,
          requiredLevelOfAssurance: 1,
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
          minimumLevelOfAssurance: 1,
          idTokenLevelOfAssurance: 4,
          requiredLevelOfAssurance: 1,
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
          minimumLevelOfAssurance: 2,
          idTokenLevelOfAssurance: 2,
          requiredLevelOfAssurance: 2,
        }),
        createTestAccount({ requireMfa: false }),
      ),
    ).toBe("confirmed");
  });
});
