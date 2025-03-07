import { KryptosKit } from "@lindorm/kryptos";
import {
  getOctPbkdfKeyWrapDecryptionKey,
  getOctPbkdfKeyWrapEncryptionKey,
} from "./get-oct-pbkdf-key-wrap-keys";

describe("getOctKeyWrap", () => {
  test("should return PBES2-HS256+A128KW", () => {
    const kryptos = KryptosKit.make.enc.oct({ algorithm: "PBES2-HS256+A128KW" });

    const result = getOctPbkdfKeyWrapEncryptionKey({ encryption: "A128GCM", kryptos });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      pbkdfIterations: expect.any(Number),
      pbkdfSalt: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
    });

    expect(
      getOctPbkdfKeyWrapDecryptionKey({
        encryption: "A128GCM",
        kryptos,
        pbkdfIterations: result.pbkdfIterations,
        pbkdfSalt: result.pbkdfSalt,
        publicEncryptionKey: result.publicEncryptionKey,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });

  test("should return PBES2-HS384+A192KW", () => {
    const kryptos = KryptosKit.make.enc.oct({ algorithm: "PBES2-HS384+A192KW" });

    const result = getOctPbkdfKeyWrapEncryptionKey({ encryption: "A128GCM", kryptos });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      pbkdfIterations: expect.any(Number),
      pbkdfSalt: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
    });

    expect(
      getOctPbkdfKeyWrapDecryptionKey({
        encryption: "A128GCM",
        kryptos,
        pbkdfIterations: result.pbkdfIterations,
        pbkdfSalt: result.pbkdfSalt,
        publicEncryptionKey: result.publicEncryptionKey,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });

  test("should return PBES2-HS512+A256KW", () => {
    const kryptos = KryptosKit.make.enc.oct({ algorithm: "PBES2-HS512+A256KW" });

    const result = getOctPbkdfKeyWrapEncryptionKey({ encryption: "A128GCM", kryptos });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      pbkdfIterations: expect.any(Number),
      pbkdfSalt: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
    });

    expect(
      getOctPbkdfKeyWrapDecryptionKey({
        encryption: "A128GCM",
        kryptos,
        pbkdfIterations: result.pbkdfIterations,
        pbkdfSalt: result.pbkdfSalt,
        publicEncryptionKey: result.publicEncryptionKey,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });
});
