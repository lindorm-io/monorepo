import { DeviceFactor } from "../enum";
import { assertConfirmationTokenFactorLength } from "./assert-confirmation-token-factor-length";

describe("assertConfirmationTokenFactorLength", () => {
  let token: any;

  beforeEach(() => {
    token = {
      claims: { factors: [DeviceFactor.POSSESSION, DeviceFactor.KNOWLEDGE] },
    };
  });

  test("should resolve on high amount of factors", () => {
    expect(() => assertConfirmationTokenFactorLength(token, 1)).not.toThrow();
  });

  test("resolve on exact amount of factors", () => {
    expect(() => assertConfirmationTokenFactorLength(token, 2)).not.toThrow();
  });

  test("should throw on low amount of factors", () => {
    expect(() => assertConfirmationTokenFactorLength(token, 3)).toThrow();
  });
});
