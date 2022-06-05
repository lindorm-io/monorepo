import { FlowType } from "../enum";
import { getPrioritizedFlow } from "./get-prioritized-flow";
import { createTestLoginSession } from "../fixtures/entity";

describe("getPrioritizedFlow", () => {
  test("should resolve highest priority", () => {
    expect(
      getPrioritizedFlow(
        createTestLoginSession({
          allowedFlows: [FlowType.SESSION_OTP, FlowType.PHONE_OTP],
        }),
      ),
    ).toBe("session_otp");
  });

  test("should resolve highest prioritized flow", () => {
    expect(
      getPrioritizedFlow(
        createTestLoginSession({
          allowedFlows: [FlowType.MFA_COOKIE, FlowType.TIME_BASED_OTP, FlowType.PASSWORD],
        }),
      ),
    ).toBe("mfa_cookie");
  });

  test("should take requested methods into consideration", () => {
    expect(
      getPrioritizedFlow(
        createTestLoginSession({
          allowedFlows: [FlowType.EMAIL_LINK, FlowType.PASSWORD],
          requestedAuthenticationMethods: [FlowType.EMAIL_LINK],
        }),
      ),
    ).toBe("email_link");
  });
});
