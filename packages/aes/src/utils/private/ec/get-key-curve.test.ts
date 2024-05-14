import { EcCurve } from "@lindorm/kryptos";
import { TEST_EC_KEY } from "../../../__fixtures__/keys";
import { AesError } from "../../../errors";
import { _getKeyCurve } from "./get-key-curve";

describe("getKeyCurve", () => {
  test("should return curve", () => {
    const exported = TEST_EC_KEY.export("der");
    const curve = exported.curve as EcCurve;

    if (!curve) {
      throw new AesError("Invalid EC key set");
    }

    expect(_getKeyCurve(curve)).toBe("secp521r1");
  });
});
