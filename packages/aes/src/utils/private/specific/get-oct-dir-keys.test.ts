import { Kryptos } from "@lindorm/kryptos";
import { _getOctDirDecryptionKey, _getOctDirEncryptionKey } from "./get-oct-dir-keys";

describe("getOctDirKeys", () => {
  test("should return dir key with hkdf", () => {
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
      hkdfSalt: expect.any(Buffer),
    });

    expect(
      _getOctDirDecryptionKey({
        encryption: "aes-128-gcm",
        kryptos,
        hkdfSalt: result.hkdfSalt,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });

  test("should return dir key with pbkdf", () => {
    const kryptos = Kryptos.from("b64", {
      algorithm: "dir",
      privateKey: Buffer.from("short", "utf8").toString("base64url"),
      publicKey: "",
      type: "oct",
      use: "enc",
    });

    const result = _getOctDirEncryptionKey({
      encryption: "aes-128-gcm",
      kryptos,
    });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      pbkdfIterations: expect.any(Number),
      pbkdfSalt: expect.any(Buffer),
    });

    expect(
      _getOctDirDecryptionKey({
        encryption: "aes-128-gcm",
        kryptos,
        pbkdfIterations: result.pbkdfIterations,
        pbkdfSalt: result.pbkdfSalt,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });
});
