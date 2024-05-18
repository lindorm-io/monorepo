import { Kryptos } from "@lindorm/kryptos";
import { _getOctDirDecryptionKey, _getOctDirEncryptionKey } from "./get-oct-dir-keys";

describe("getOctDirKeys", () => {
  test("should return dir key", () => {
    const kryptos = Kryptos.generate({
      algorithm: "dir",
      type: "oct",
      use: "enc",
    });

    const result = _getOctDirEncryptionKey({
      encryption: "aes-128-gcm",
      kryptos,
    });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      salt: expect.any(Buffer),
    });

    expect(
      _getOctDirDecryptionKey({
        encryption: "aes-128-gcm",
        kryptos,
        salt: result.salt,
      }),
    ).toEqual(result.contentEncryptionKey);
  });
});
