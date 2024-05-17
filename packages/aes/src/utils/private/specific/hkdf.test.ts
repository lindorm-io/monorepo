import { TEST_OCT_KEY } from "../../../__fixtures__/keys";
import { _hkdf } from "./hkdf";

describe("hkdf", () => {
  test("should create a key derivation", () => {
    const result = _hkdf({
      derivationKey: TEST_OCT_KEY.export("der").privateKey!,
      keyLength: 16,
    });

    expect(result).toEqual({
      derivedKey: expect.any(Buffer),
      salt: expect.any(Buffer),
    });

    expect(
      _hkdf({
        derivationKey: TEST_OCT_KEY.export("der").privateKey!,
        keyLength: 16,
        salt: result.salt,
      }),
    ).toEqual({
      derivedKey: result.derivedKey,
      salt: result.salt,
    });
  });
});
