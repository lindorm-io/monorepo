import { Kryptos } from "@lindorm/kryptos";
import {
  _getOctKeyWrapDecryptionKey,
  _getOctKeyWrapEncryptionKey,
} from "./get-oct-key-wrap-keys";

describe("getOctKeyWrap", () => {
  describe("hkdf", () => {
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
        hkdfSalt: expect.any(Buffer),
      });

      expect(
        _getOctKeyWrapDecryptionKey({
          encryption: "aes-128-gcm",
          kryptos,
          publicEncryptionKey: result.publicEncryptionKey,
          hkdfSalt: result.hkdfSalt,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
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
        hkdfSalt: expect.any(Buffer),
      });

      expect(
        _getOctKeyWrapDecryptionKey({
          encryption: "aes-192-gcm",
          kryptos,
          publicEncryptionKey: result.publicEncryptionKey,
          hkdfSalt: result.hkdfSalt,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
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
        hkdfSalt: expect.any(Buffer),
      });

      expect(
        _getOctKeyWrapDecryptionKey({
          encryption: "aes-256-gcm",
          kryptos,
          publicEncryptionKey: result.publicEncryptionKey,
          hkdfSalt: result.hkdfSalt,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });
  });

  describe("pbkdf", () => {
    test("should return A128KW with pbkdf", () => {
      const kryptos = Kryptos.from("b64", {
        algorithm: "A128KW",
        privateKey: Buffer.from("short", "utf8").toString("base64url"),
        publicKey: "",
        type: "oct",
        use: "enc",
      });

      const result = _getOctKeyWrapEncryptionKey({ encryption: "aes-128-gcm", kryptos });

      expect(result).toEqual({
        contentEncryptionKey: expect.any(Buffer),
        pbkdfIterations: expect.any(Number),
        pbkdfSalt: expect.any(Buffer),
        publicEncryptionKey: expect.any(Buffer),
      });

      expect(
        _getOctKeyWrapDecryptionKey({
          encryption: "aes-128-gcm",
          kryptos,
          pbkdfIterations: result.pbkdfIterations,
          pbkdfSalt: result.pbkdfSalt,
          publicEncryptionKey: result.publicEncryptionKey,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });
  });
});
