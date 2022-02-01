import { FlowType } from "../enum";
import { isPollingRequired } from "./is-polling-required";

describe("isPollingRequired", () => {
  test("should resolve true", () => {
    expect(isPollingRequired(FlowType.BANK_ID_SE)).toBe(true);
  });

  test("should resolve false", () => {
    expect(isPollingRequired(FlowType.EMAIL_OTP)).toBe(false);
  });
});
