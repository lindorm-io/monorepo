import { TEST_OCT_KEY } from "../../../__fixtures__/keys";
import { _pbkdf } from "./pbkdf";

describe("pbkdf", () => {
  test("should create a key derivation", () => {
    const result = _pbkdf({
      algorithm: "SHA256",
      derivationKey: TEST_OCT_KEY.export("der").privateKey!,
      keyLength: 16,
    });

    expect(result).toEqual({
      derivedKey: expect.any(Buffer),
      pbkdfIterations: expect.any(Number),
      pbkdfSalt: expect.any(Buffer),
    });

    expect(result.pbkdfIterations).toBeGreaterThanOrEqual(90000);
    expect(result.pbkdfIterations).toBeLessThanOrEqual(110000);

    expect(
      _pbkdf({
        algorithm: "SHA256",
        derivationKey: TEST_OCT_KEY.export("der").privateKey!,
        keyLength: 16,
        pbkdfIterations: result.pbkdfIterations,
        pbkdfSalt: result.pbkdfSalt,
      }),
    ).toEqual({
      derivedKey: result.derivedKey,
      pbkdfIterations: result.pbkdfIterations,
      pbkdfSalt: result.pbkdfSalt,
    });
  });
});
