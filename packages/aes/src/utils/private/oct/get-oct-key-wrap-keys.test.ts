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

    const result = _getOctKeyWrapEncryptionKey({ encryption: "A128GCM", kryptos });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      hkdfSalt: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
    });

    expect(
      _getOctKeyWrapDecryptionKey({
        encryption: "A128GCM",
        hkdfSalt: result.hkdfSalt,
        kryptos,
        publicEncryptionKey: result.publicEncryptionKey,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });

  test("should return A192KW", () => {
    const kryptos = Kryptos.generate({
      algorithm: "A192KW",
      type: "oct",
      use: "enc",
    });

    const result = _getOctKeyWrapEncryptionKey({ encryption: "A192GCM", kryptos });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      hkdfSalt: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
    });

    expect(
      _getOctKeyWrapDecryptionKey({
        encryption: "A192GCM",
        hkdfSalt: result.hkdfSalt,
        kryptos,
        publicEncryptionKey: result.publicEncryptionKey,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });

  test("should return A256KW", () => {
    const kryptos = Kryptos.generate({
      algorithm: "A256KW",
      type: "oct",
      use: "enc",
    });

    const result = _getOctKeyWrapEncryptionKey({ encryption: "A256GCM", kryptos });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      hkdfSalt: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
    });

    expect(
      _getOctKeyWrapDecryptionKey({
        encryption: "A256GCM",
        hkdfSalt: result.hkdfSalt,
        kryptos,
        publicEncryptionKey: result.publicEncryptionKey,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });
});
