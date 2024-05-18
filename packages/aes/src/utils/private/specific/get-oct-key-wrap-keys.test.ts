import { Kryptos } from "@lindorm/kryptos";
import {
  _getOctKeyWrapDecryptionKey,
  _getOctKeyWrapEncryptionKey,
} from "./get-oct-key-wrap-keys";

describe("getOctKeyWrap", () => {
  test("should return A128KW", () => {
    const kryptos = Kryptos.generate({
      algorithm: "A128KW",
      type: "oct",
      use: "enc",
    });

    const result = _getOctKeyWrapEncryptionKey({ encryption: "aes-128-gcm", kryptos });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
      salt: expect.any(Buffer),
    });

    expect(
      _getOctKeyWrapDecryptionKey({
        encryption: "aes-128-gcm",
        kryptos,
        publicEncryptionKey: result.publicEncryptionKey,
        salt: result.salt,
      }),
    ).toEqual(result.contentEncryptionKey);
  });

  test("should return A192KW", () => {
    const kryptos = Kryptos.generate({
      algorithm: "A192KW",
      type: "oct",
      use: "enc",
    });

    const result = _getOctKeyWrapEncryptionKey({ encryption: "aes-192-gcm", kryptos });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
      salt: expect.any(Buffer),
    });

    expect(
      _getOctKeyWrapDecryptionKey({
        encryption: "aes-192-gcm",
        kryptos,
        publicEncryptionKey: result.publicEncryptionKey,
        salt: result.salt,
      }),
    ).toEqual(result.contentEncryptionKey);
  });

  test("should return A256KW", () => {
    const kryptos = Kryptos.generate({
      algorithm: "A256KW",
      type: "oct",
      use: "enc",
    });

    const result = _getOctKeyWrapEncryptionKey({ encryption: "aes-256-gcm", kryptos });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
      salt: expect.any(Buffer),
    });

    expect(
      _getOctKeyWrapDecryptionKey({
        encryption: "aes-256-gcm",
        kryptos,
        publicEncryptionKey: result.publicEncryptionKey,
        salt: result.salt,
      }),
    ).toEqual(result.contentEncryptionKey);
  });
});
