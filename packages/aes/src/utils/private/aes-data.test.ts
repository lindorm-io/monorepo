import { Kryptos } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { LATEST_AES_VERSION } from "../../constants";
import { _decryptAesData, _encryptAesData } from "./aes-data";

describe("aes-data", () => {
  let data: string;

  beforeEach(async () => {
    data = randomBytes(32).toString("hex");
  });

  test("should encrypt and decrypt", () => {
    const kryptos = Kryptos.generate({
      algorithm: "dir",
      encryption: "A256GCM",
      type: "oct",
      use: "enc",
    });

    const res = _encryptAesData({ data, kryptos });

    expect(res).toEqual({
      algorithm: "dir",
      authTag: expect.any(Buffer),
      content: expect.any(Buffer),
      encryption: "A256GCM",
      format: "base64url",
      hkdfSalt: undefined,
      initialisationVector: expect.any(Buffer),
      keyId: expect.any(Buffer),
      publicEncryptionJwk: undefined,
      publicEncryptionKey: undefined,
      version: LATEST_AES_VERSION,
    });

    expect(_decryptAesData({ ...res, kryptos })).toBe(data);
  });

  describe("cbc", () => {
    test("should encrypt and decrypt with A128CBC-HS256", () => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption: "A128CBC-HS256",
        type: "oct",
        use: "enc",
      });

      const encryption = _encryptAesData({
        encryption: "A128CBC-HS256",
        data,
        kryptos,
      });

      expect(encryption.encryption).toBe("A128CBC-HS256");
      expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
    });

    test("should encrypt and decrypt with A192CBC-HS384", () => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption: "A192CBC-HS384",
        type: "oct",
        use: "enc",
      });

      const encryption = _encryptAesData({
        encryption: "A192CBC-HS384",
        data,
        kryptos,
      });

      expect(encryption.encryption).toBe("A192CBC-HS384");
      expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
    });

    test("should encrypt and decrypt with A256CBC-HS512", () => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption: "A256CBC-HS512",
        type: "oct",
        use: "enc",
      });

      const encryption = _encryptAesData({
        encryption: "A256CBC-HS512",
        data,
        kryptos,
      });

      expect(encryption.encryption).toBe("A256CBC-HS512");
      expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
    });
  });

  describe("gcm", () => {
    test("should encrypt and decrypt with A128GCM", () => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption: "A128GCM",
        type: "oct",
        use: "enc",
      });

      const encryption = _encryptAesData({
        encryption: "A128GCM",
        data,
        kryptos,
      });

      expect(encryption.encryption).toBe("A128GCM");
      expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
    });

    test("should encrypt and decrypt with A192GCM", () => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption: "A192GCM",
        type: "oct",
        use: "enc",
      });

      const encryption = _encryptAesData({
        encryption: "A192GCM",
        data,
        kryptos,
      });

      expect(encryption.encryption).toBe("A192GCM");
      expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
    });

    test("should encrypt and decrypt with A256GCM", () => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption: "A256GCM",
        type: "oct",
        use: "enc",
      });

      const encryption = _encryptAesData({
        encryption: "A256GCM",
        data,
        kryptos,
      });

      expect(encryption.encryption).toBe("A256GCM");
      expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
    });
  });

  // describe("ec", () => {
  //   test("should encrypt and decrypt", () => {
  //     const encryption = _encryptAesData({
  //       data,
  //       kryptos: TEST_EC_KEY,
  //     });

  //     expect(encryption.encryption).toBe("A256GCM");
  //     expect(encryption.encryptionKeyAlgorithm).toBe("ECDH-ES");
  //     expect(_decryptAesData({ ...encryption, kryptos: TEST_EC_KEY })).toBe(data);
  //   });
  // });

  // describe("oct", () => {
  //   test("should encrypt and decrypt", () => {
  //     const encryption = _encryptAesData({
  //       data,
  //       kryptos: TEST_OCT_KEY,
  //     });

  //     expect(encryption.encryption).toBe("A256GCM");
  //     expect(encryption.encryptionKeyAlgorithm).toBe("dir");
  //     expect(_decryptAesData({ ...encryption, kryptos: TEST_OCT_KEY })).toBe(data);
  //   });
  // });

  // describe("rsa", () => {
  //   test("should encrypt and decrypt with RSA-OAEP", () => {
  //     const kryptos = Kryptos.generate({
  //       algorithm: "RSA-OAEP",
  //       type: "RSA",
  //       use: "enc",
  //     });

  //     const encryption = _encryptAesData({
  //       data,
  //       kryptos,
  //     });

  //     expect(encryption.encryption).toBe("A256GCM");
  //     expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP");
  //     expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
  //   });

  //   test("should encrypt and decrypt with RSA-OAEP-256", () => {
  //     const kryptos = Kryptos.generate({
  //       algorithm: "RSA-OAEP-256",
  //       type: "RSA",
  //       use: "enc",
  //     });

  //     const encryption = _encryptAesData({
  //       data,
  //       kryptos,
  //     });

  //     expect(encryption.encryption).toBe("A256GCM");
  //     expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP-256");
  //     expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
  //   });

  //   test("should encrypt and decrypt with RSA-OAEP-384", () => {
  //     const kryptos = Kryptos.generate({
  //       algorithm: "RSA-OAEP-384",
  //       type: "RSA",
  //       use: "enc",
  //     });

  //     const encryption = _encryptAesData({
  //       data,
  //       kryptos,
  //     });

  //     expect(encryption.encryption).toBe("A256GCM");
  //     expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP-384");
  //     expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
  //   });

  //   test("should encrypt and decrypt with RSA-OAEP-512", () => {
  //     const kryptos = Kryptos.generate({
  //       algorithm: "RSA-OAEP-512",
  //       type: "RSA",
  //       use: "enc",
  //     });

  //     const encryption = _encryptAesData({
  //       data,
  //       kryptos,
  //     });

  //     expect(encryption.encryption).toBe("A256GCM");
  //     expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP-512");
  //     expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
  //   });
  // });
});
