import { TEST_OCT_KEY } from "../../../__fixtures__/keys";
import { hkdf } from "./hkdf";

describe("hkdf", () => {
  test("should create a key derivation", () => {
    const result = hkdf({
      derivationKey: TEST_OCT_KEY.export("der").privateKey!,
      keyLength: 16,
    });

    expect(result).toEqual({
      derivedKey: expect.any(Buffer),
      hkdfSalt: expect.any(Buffer),
    });

    expect(
      hkdf({
        derivationKey: TEST_OCT_KEY.export("der").privateKey!,
        keyLength: 16,
        hkdfSalt: result.hkdfSalt,
      }),
    ).toEqual({
      derivedKey: result.derivedKey,
      hkdfSalt: result.hkdfSalt,
    });
  });
});
