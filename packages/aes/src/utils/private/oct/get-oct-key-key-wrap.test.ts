import { KryptosKit } from "@lindorm/kryptos";
import {
  getOctKeyWrapDecryptionKey,
  getOctKeyWrapEncryptionKey,
} from "./get-oct-key-key-wrap";

describe("getOctKeyWrap", () => {
  describe("ECB", () => {
    test("should return A128KW", () => {
      const kryptos = KryptosKit.generate.enc.oct({ algorithm: "A128KW" });

      const result = getOctKeyWrapEncryptionKey({ encryption: "A128GCM", kryptos });

      expect(result).toEqual({
        contentEncryptionKey: expect.any(Buffer),
        hkdfSalt: expect.any(Buffer),
        publicEncryptionKey: expect.any(Buffer),
      });

      expect(
        getOctKeyWrapDecryptionKey({
          encryption: "A128GCM",
          hkdfSalt: result.hkdfSalt,
          kryptos,
          publicEncryptionKey: result.publicEncryptionKey,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });

    test("should return A192KW", () => {
      const kryptos = KryptosKit.generate.enc.oct({ algorithm: "A192KW" });

      const result = getOctKeyWrapEncryptionKey({ encryption: "A192GCM", kryptos });

      expect(result).toEqual({
        contentEncryptionKey: expect.any(Buffer),
        hkdfSalt: expect.any(Buffer),
        publicEncryptionKey: expect.any(Buffer),
      });

      expect(
        getOctKeyWrapDecryptionKey({
          encryption: "A192GCM",
          hkdfSalt: result.hkdfSalt,
          kryptos,
          publicEncryptionKey: result.publicEncryptionKey,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });

    test("should return A256KW", () => {
      const kryptos = KryptosKit.generate.enc.oct({ algorithm: "A256KW" });

      const result = getOctKeyWrapEncryptionKey({ encryption: "A256GCM", kryptos });

      expect(result).toEqual({
        contentEncryptionKey: expect.any(Buffer),
        hkdfSalt: expect.any(Buffer),
        publicEncryptionKey: expect.any(Buffer),
      });

      expect(
        getOctKeyWrapDecryptionKey({
          encryption: "A256GCM",
          hkdfSalt: result.hkdfSalt,
          kryptos,
          publicEncryptionKey: result.publicEncryptionKey,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });
  });

  describe("GCM", () => {
    test("should return A128GCMKW", () => {
      const kryptos = KryptosKit.generate.enc.oct({ algorithm: "A128GCMKW" });

      const result = getOctKeyWrapEncryptionKey({ encryption: "A128GCM", kryptos });

      expect(result).toEqual({
        contentEncryptionKey: expect.any(Buffer),
        hkdfSalt: expect.any(Buffer),
        publicEncryptionIv: expect.any(Buffer),
        publicEncryptionKey: expect.any(Buffer),
        publicEncryptionTag: expect.any(Buffer),
      });

      expect(
        getOctKeyWrapDecryptionKey({
          encryption: "A128GCM",
          hkdfSalt: result.hkdfSalt,
          kryptos,
          publicEncryptionIv: result.publicEncryptionIv,
          publicEncryptionKey: result.publicEncryptionKey,
          publicEncryptionTag: result.publicEncryptionTag,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });

    test("should return A192GCMKW", () => {
      const kryptos = KryptosKit.generate.enc.oct({ algorithm: "A192GCMKW" });

      const result = getOctKeyWrapEncryptionKey({ encryption: "A192GCM", kryptos });

      expect(result).toEqual({
        contentEncryptionKey: expect.any(Buffer),
        hkdfSalt: expect.any(Buffer),
        publicEncryptionIv: expect.any(Buffer),
        publicEncryptionKey: expect.any(Buffer),
        publicEncryptionTag: expect.any(Buffer),
      });

      expect(
        getOctKeyWrapDecryptionKey({
          encryption: "A192GCM",
          hkdfSalt: result.hkdfSalt,
          kryptos,
          publicEncryptionIv: result.publicEncryptionIv,
          publicEncryptionKey: result.publicEncryptionKey,
          publicEncryptionTag: result.publicEncryptionTag,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });

    test("should return A256GCMKW", () => {
      const kryptos = KryptosKit.generate.enc.oct({ algorithm: "A256GCMKW" });

      const result = getOctKeyWrapEncryptionKey({ encryption: "A256GCM", kryptos });

      expect(result).toEqual({
        contentEncryptionKey: expect.any(Buffer),
        hkdfSalt: expect.any(Buffer),
        publicEncryptionIv: expect.any(Buffer),
        publicEncryptionKey: expect.any(Buffer),
        publicEncryptionTag: expect.any(Buffer),
      });

      expect(
        getOctKeyWrapDecryptionKey({
          encryption: "A256GCM",
          hkdfSalt: result.hkdfSalt,
          kryptos,
          publicEncryptionIv: result.publicEncryptionIv,
          publicEncryptionKey: result.publicEncryptionKey,
          publicEncryptionTag: result.publicEncryptionTag,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });
  });
});
