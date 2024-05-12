import { EcCurve } from "@lindorm/kryptos";
import { EC_KEY_SET } from "../../../__fixtures__/ec-keys.fixture";
import { AesError } from "../../../errors";
import { _getKeyCurve } from "./get-key-curve";

describe("getKeyCurve", () => {
  test("should return curve", () => {
    const exported = EC_KEY_SET.export("der");
    const curve = exported.curve as EcCurve;

    if (!curve) {
      throw new AesError("Invalid EC key set");
    }

    expect(_getKeyCurve(curve)).toBe("secp521r1");
  });
});
