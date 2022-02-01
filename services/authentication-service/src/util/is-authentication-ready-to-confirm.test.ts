import { isAuthenticationReadyToConfirm } from "./is-authentication-ready-to-confirm";
import { getTestLoginSession } from "../test/entity";
import { FlowType } from "../enum";

describe("isAuthenticationReadyToConfirm", () => {
  test("should resolve true", () => {
    expect(
      isAuthenticationReadyToConfirm(
        getTestLoginSession({
          amrValues: [FlowType.EMAIL_OTP, FlowType.SESSION_OTP],
          levelOfAssurance: 3,
        }),
      ),
    ).toBe(true);
  });

  test("should resolve false when identity id is not set", () => {
    expect(isAuthenticationReadyToConfirm(getTestLoginSession({ identityId: null }))).toBe(false);
  });

  test("should resolve false when level of assurance is lower than desired", () => {
    expect(isAuthenticationReadyToConfirm(getTestLoginSession({ levelOfAssurance: 1 }))).toBe(
      false,
    );
  });

  test("should resolve false when amr values are not set", () => {
    expect(isAuthenticationReadyToConfirm(getTestLoginSession({ amrValues: [] }))).toBe(false);
  });

  test("should resolve false when amr values are lower than two", () => {
    expect(
      isAuthenticationReadyToConfirm(getTestLoginSession({ amrValues: [FlowType.EMAIL_OTP] })),
    ).toBe(false);
  });
});
