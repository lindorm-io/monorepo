import { Kryptos } from "@lindorm/kryptos";
import {
  _getOctPbkdfKeyWrapDecryptionKey,
  _getOctPbkdfKeyWrapEncryptionKey,
} from "./get-oct-pbkdf-key-wrap-keys";

describe("getOctKeyWrap", () => {
  test("should return PBES2-HS256+A128KW", () => {
    const kryptos = Kryptos.generate({
      algorithm: "PBES2-HS256+A128KW",
      type: "oct",
      use: "enc",
    });

    const result = _getOctPbkdfKeyWrapEncryptionKey({ encryption: "A128GCM", kryptos });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      pbkdfIterations: expect.any(Number),
      pbkdfSalt: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
    });

    expect(
      _getOctPbkdfKeyWrapDecryptionKey({
        encryption: "A128GCM",
        kryptos,
        pbkdfIterations: result.pbkdfIterations,
        pbkdfSalt: result.pbkdfSalt,
        publicEncryptionKey: result.publicEncryptionKey,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });

  test("should return PBES2-HS384+A192KW", () => {
    const kryptos = Kryptos.generate({
      algorithm: "PBES2-HS384+A192KW",
      type: "oct",
      use: "enc",
    });

    const result = _getOctPbkdfKeyWrapEncryptionKey({ encryption: "A128GCM", kryptos });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      pbkdfIterations: expect.any(Number),
      pbkdfSalt: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
    });

    expect(
      _getOctPbkdfKeyWrapDecryptionKey({
        encryption: "A128GCM",
        kryptos,
        pbkdfIterations: result.pbkdfIterations,
        pbkdfSalt: result.pbkdfSalt,
        publicEncryptionKey: result.publicEncryptionKey,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });

  test("should return PBES2-HS512+A256KW", () => {
    const kryptos = Kryptos.generate({
      algorithm: "PBES2-HS512+A256KW",
      type: "oct",
      use: "enc",
    });

    const result = _getOctPbkdfKeyWrapEncryptionKey({ encryption: "A128GCM", kryptos });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      pbkdfIterations: expect.any(Number),
      pbkdfSalt: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
    });

    expect(
      _getOctPbkdfKeyWrapDecryptionKey({
        encryption: "A128GCM",
        kryptos,
        pbkdfIterations: result.pbkdfIterations,
        pbkdfSalt: result.pbkdfSalt,
        publicEncryptionKey: result.publicEncryptionKey,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });
});
