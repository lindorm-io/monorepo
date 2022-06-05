import { canFlowGenerateMfaCookie } from "./can-flow-generate-mfa-cookie";
import { createTestLoginSession } from "../fixtures/entity";
import { FlowType } from "../enum";

describe("canFlowGenerateMfaCookie", () => {
  test("should resolve true", () => {
    expect(
      canFlowGenerateMfaCookie(
        createTestLoginSession({
          amrValues: [FlowType.EMAIL_OTP, FlowType.SESSION_OTP],
          remember: true,
        }),
        FlowType.SESSION_OTP,
      ),
    ).toBe(true);
  });

  test("should resolve false when remember is false", () => {
    expect(
      canFlowGenerateMfaCookie(createTestLoginSession({ remember: false }), FlowType.SESSION_OTP),
    ).toBe(false);
  });

  test("should resolve false when identity id is not set", () => {
    expect(
      canFlowGenerateMfaCookie(
        createTestLoginSession({ identityId: null, remember: true }),
        FlowType.SESSION_OTP,
      ),
    ).toBe(false);
  });

  test("should resolve false when amr values are not set", () => {
    expect(
      canFlowGenerateMfaCookie(
        createTestLoginSession({ amrValues: [], remember: true }),
        FlowType.SESSION_OTP,
      ),
    ).toBe(false);
  });
});
