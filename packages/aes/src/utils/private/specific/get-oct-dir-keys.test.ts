import { TEST_OCT_KEY } from "../../../__fixtures__/keys";
import { _getOctDirDecryptionKey, _getOctDirEncryptionKey } from "./get-oct-dir-keys";

describe("getOctDirKeys", () => {
  test("should return dir key", () => {
    const result = _getOctDirEncryptionKey({
      encryption: "aes-128-gcm",
      kryptos: TEST_OCT_KEY,
    });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      salt: expect.any(Buffer),
    });

    expect(
      _getOctDirDecryptionKey({
        encryption: "aes-128-gcm",
        kryptos: TEST_OCT_KEY,
        salt: result.salt,
      }),
    ).toEqual(result.contentEncryptionKey);
  });
});
