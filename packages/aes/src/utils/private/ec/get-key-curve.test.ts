import { EC_KEY_SET } from "../../../fixtures/ec-keys.fixture";
import { getKeyCurve } from "./get-key-curve";

describe("getKeyCurve", () => {
  test("should return curve", () => {
    const { curve } = EC_KEY_SET.export("der");

    expect(getKeyCurve(curve)).toBe("secp521r1");
  });
});
