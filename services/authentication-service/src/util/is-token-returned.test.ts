import { FlowType } from "../enum";
import { isTokenReturned } from "./is-token-returned";

describe("isTokenReturned", () => {
  test("should resolve true", () => {
    expect(isTokenReturned(FlowType.DEVICE_CHALLENGE)).toBe(true);
  });

  test("should resolve false", () => {
    expect(isTokenReturned(FlowType.EMAIL_LINK)).toBe(false);
  });
});
