import { FlowType } from "../enum";
import { getPrioritizedFlow } from "./get-prioritized-flow";
import { getTestLoginSession } from "../test/entity";

describe("getPrioritizedFlow", () => {
  test("should resolve highest priority", () => {
    expect(
      getPrioritizedFlow(
        getTestLoginSession({
          allowedFlows: [FlowType.SESSION_OTP, FlowType.PHONE_OTP],
        }),
      ),
    ).toBe("session_otp");
  });

  test("should resolve highest prioritized flow", () => {
    expect(
      getPrioritizedFlow(
        getTestLoginSession({
          allowedFlows: [FlowType.MFA_COOKIE, FlowType.TIME_BASED_OTP, FlowType.PASSWORD],
        }),
      ),
    ).toBe("mfa_cookie");
  });

  test("should take requested methods into consideration", () => {
    expect(
      getPrioritizedFlow(
        getTestLoginSession({
          allowedFlows: [FlowType.EMAIL_LINK, FlowType.PASSWORD],
          requestedAuthenticationMethods: [FlowType.EMAIL_LINK],
        }),
      ),
    ).toBe("email_link");
  });
});
