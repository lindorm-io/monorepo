import { canFlowGenerateMfaCookie } from "./can-flow-generate-mfa-cookie";
import { getTestLoginSession } from "../test/entity";
import { FlowType } from "../enum";

describe("canFlowGenerateMfaCookie", () => {
  test("should resolve true", () => {
    expect(
      canFlowGenerateMfaCookie(
        getTestLoginSession({
          amrValues: [FlowType.EMAIL_OTP, FlowType.SESSION_OTP],
          remember: true,
        }),
        FlowType.SESSION_OTP,
      ),
    ).toBe(true);
  });

  test("should resolve false when remember is false", () => {
    expect(
      canFlowGenerateMfaCookie(getTestLoginSession({ remember: false }), FlowType.SESSION_OTP),
    ).toBe(false);
  });

  test("should resolve false when identity id is not set", () => {
    expect(
      canFlowGenerateMfaCookie(
        getTestLoginSession({ identityId: null, remember: true }),
        FlowType.SESSION_OTP,
      ),
    ).toBe(false);
  });

  test("should resolve false when amr values are not set", () => {
    expect(
      canFlowGenerateMfaCookie(
        getTestLoginSession({ amrValues: [], remember: true }),
        FlowType.SESSION_OTP,
      ),
    ).toBe(false);
  });
});
