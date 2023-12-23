import { PUBLIC_EC_JWK } from "../../../fixtures/ec-keys.fixture";
import { getKeyCurve } from "./get-key-curve";

describe("getKeyCurve", () => {
  test("should return curve", () => {
    expect(getKeyCurve(PUBLIC_EC_JWK)).toBe("secp521r1");
  });
});
