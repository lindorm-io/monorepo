import { Kryptos } from "@lindorm/kryptos";
import { _getOctDirDecryptionKey, _getOctDirEncryptionKey } from "./get-oct-dir-keys";

describe("get-oct-std-keys", () => {
  describe("cbc", () => {
    test("should resolve dir key for A128CBC-HS256", () => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption: "A128CBC-HS256",
        type: "oct",
        use: "enc",
      });

      const result = _getOctDirEncryptionKey({
        encryption: "A128CBC-HS256",
        kryptos,
      });

      expect(result).toEqual({
        contentEncryptionKey: expect.any(Buffer),
      });

      expect(
        _getOctDirDecryptionKey({
          encryption: "A128CBC-HS256",
          kryptos,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });

    test("should resolve dir key for A192CBC-HS384", () => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption: "A192CBC-HS384",
        type: "oct",
        use: "enc",
      });

      const result = _getOctDirEncryptionKey({
        encryption: "A192CBC-HS384",
        kryptos,
      });

      expect(result).toEqual({
        contentEncryptionKey: expect.any(Buffer),
      });

      expect(
        _getOctDirDecryptionKey({
          encryption: "A192CBC-HS384",
          kryptos,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });

    test("should resolve dir key for A256CBC-HS512", () => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption: "A256CBC-HS512",
        type: "oct",
        use: "enc",
      });

      const result = _getOctDirEncryptionKey({
        encryption: "A256CBC-HS512",
        kryptos,
      });

      expect(result).toEqual({
        contentEncryptionKey: expect.any(Buffer),
      });

      expect(
        _getOctDirDecryptionKey({
          encryption: "A256CBC-HS512",
          kryptos,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });
  });

  describe("gcm", () => {
    test("should resolve dir key for A128GCM", () => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption: "A128GCM",
        type: "oct",
        use: "enc",
      });

      const result = _getOctDirEncryptionKey({
        encryption: "A128GCM",
        kryptos,
      });

      expect(result).toEqual({
        contentEncryptionKey: expect.any(Buffer),
      });

      expect(
        _getOctDirDecryptionKey({
          encryption: "A128GCM",
          kryptos,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });

    test("should resolve dir key for A192GCM", () => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption: "A192GCM",
        type: "oct",
        use: "enc",
      });

      const result = _getOctDirEncryptionKey({
        encryption: "A192GCM",
        kryptos,
      });

      expect(result).toEqual({
        contentEncryptionKey: expect.any(Buffer),
      });

      expect(
        _getOctDirDecryptionKey({
          encryption: "A192GCM",
          kryptos,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });

    test("should resolve dir key for A256GCM", () => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption: "A256GCM",
        type: "oct",
        use: "enc",
      });

      const result = _getOctDirEncryptionKey({
        encryption: "A256GCM",
        kryptos,
      });

      expect(result).toEqual({
        contentEncryptionKey: expect.any(Buffer),
      });

      expect(
        _getOctDirDecryptionKey({
          encryption: "A256GCM",
          kryptos,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });
  });
});
