import { EC_KEY_SET } from "../../../__fixtures__/ec-keys.fixture";
import { AesError } from "../../../errors";
import { _getKeyCurve } from "./get-key-curve";

describe("getKeyCurve", () => {
  test("should return curve", () => {
    const { curve } = EC_KEY_SET.export("der");

    if (!curve) {
      throw new AesError("Invalid EC key set");
    }

    expect(_getKeyCurve(curve)).toBe("secp521r1");
  });
});
