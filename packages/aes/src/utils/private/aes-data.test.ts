import { IKryptos, Kryptos } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { TEST_EC_KEY, TEST_OCT_KEY, TEST_RSA_KEY } from "../../__fixtures__/keys";
import { LATEST_AES_VERSION } from "../../constants";
import { _decryptAesData, _encryptAesData } from "./aes-data";

describe("aes-data", () => {
  let data: string;
  let kryptos: IKryptos;

  beforeEach(async () => {
    data = randomBytes(32).toString("hex");
    kryptos = Kryptos.generate({ type: "oct", use: "enc", size: 64 });
  });

  test("should encrypt", () => {
    expect(_encryptAesData({ data, kryptos })).toEqual({
      authTag: expect.any(Buffer),
      content: expect.any(Buffer),
      encryption: "aes-256-gcm",
      encryptionKeyAlgorithm: "dir",
      format: "base64url",
      initialisationVector: expect.any(Buffer),
      integrityHash: undefined,
      keyId: expect.any(Buffer),
      publicEncryptionJwk: undefined,
      publicEncryptionKey: undefined,
      salt: expect.any(Buffer),
      version: LATEST_AES_VERSION,
    });
  });

  test("should decrypt", () => {
    const encryption = _encryptAesData({ data, kryptos });

    expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
  });

  describe("cbc", () => {
    test("should encrypt and decrypt with aes-128-cbc", () => {
      const encryption = _encryptAesData({
        encryption: "aes-128-cbc",
        data,
        kryptos,
      });

      expect(encryption.encryption).toBe("aes-128-cbc");
      expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
    });

    test("should encrypt and decrypt with aes-192-cbc", () => {
      const encryption = _encryptAesData({
        encryption: "aes-192-cbc",
        data,
        kryptos,
      });

      expect(encryption.encryption).toBe("aes-192-cbc");
      expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
    });

    test("should encrypt and decrypt with aes-256-cbc", () => {
      const encryption = _encryptAesData({
        encryption: "aes-256-cbc",
        data,
        kryptos,
      });

      expect(encryption.encryption).toBe("aes-256-cbc");
      expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
    });

    test("should encrypt and decrypt with integrity algorithm", () => {
      const encryption = _encryptAesData({
        encryption: "aes-256-cbc",
        data,
        integrityHash: "SHA256",
        kryptos,
      });

      expect(encryption.encryption).toBe("aes-256-cbc");
      expect(encryption.authTag).toEqual(expect.any(Buffer));
      expect(encryption.integrityHash).toBe("SHA256");
      expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
    });
  });

  describe("gcm", () => {
    test("should encrypt and decrypt with aes-128-gcm", () => {
      const encryption = _encryptAesData({
        encryption: "aes-128-gcm",
        data,
        kryptos,
      });

      expect(encryption.encryption).toBe("aes-128-gcm");
      expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
    });

    test("should encrypt and decrypt with aes-192-gcm", () => {
      const encryption = _encryptAesData({
        encryption: "aes-192-gcm",
        data,
        kryptos,
      });

      expect(encryption.encryption).toBe("aes-192-gcm");
      expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
    });

    test("should encrypt and decrypt with aes-256-gcm", () => {
      const encryption = _encryptAesData({
        encryption: "aes-256-gcm",
        data,
        kryptos,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
    });
  });

  describe("formats", () => {
    test("should encrypt and decrypt with base64", () => {
      const encryption = _encryptAesData({
        data,
        format: "base64",
        kryptos,
      });

      expect(encryption.format).toBe("base64");
      expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
    });

    test("should encrypt and decrypt with base64url", () => {
      const encryption = _encryptAesData({
        data,
        format: "base64url",
        kryptos,
      });

      expect(encryption.format).toBe("base64url");
      expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
    });

    test("should encrypt and decrypt with hex", () => {
      const encryption = _encryptAesData({
        data,
        format: "hex",
        kryptos,
      });

      expect(encryption.format).toBe("hex");
      expect(_decryptAesData({ ...encryption, kryptos })).toBe(data);
    });
  });

  describe("ec", () => {
    test("should encrypt and decrypt", () => {
      const encryption = _encryptAesData({
        data,
        kryptos: TEST_EC_KEY,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("ECDH-ES");
      expect(_decryptAesData({ ...encryption, kryptos: TEST_EC_KEY })).toBe(data);
    });
  });

  describe("oct", () => {
    test("should encrypt and decrypt", () => {
      const encryption = _encryptAesData({
        data,
        kryptos: TEST_OCT_KEY,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("dir");
      expect(_decryptAesData({ ...encryption, kryptos: TEST_OCT_KEY })).toBe(data);
    });
  });

  describe("rsa", () => {
    test("should encrypt and decrypt with RSA-OAEP", () => {
      const key = TEST_RSA_KEY.clone({ algorithm: "RSA-OAEP" });
      const encryption = _encryptAesData({
        data,
        kryptos: key,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP");
      expect(_decryptAesData({ ...encryption, kryptos: key })).toBe(data);
    });

    test("should encrypt and decrypt with RSA-OAEP-256", () => {
      const key = TEST_RSA_KEY.clone({ algorithm: "RSA-OAEP-256" });
      const encryption = _encryptAesData({
        data,
        kryptos: key,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP-256");
      expect(_decryptAesData({ ...encryption, kryptos: key })).toBe(data);
    });

    test("should encrypt and decrypt with RSA-OAEP-384", () => {
      const key = TEST_RSA_KEY.clone({ algorithm: "RSA-OAEP-384" });
      const encryption = _encryptAesData({
        data,
        kryptos: key,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP-384");
      expect(_decryptAesData({ ...encryption, kryptos: key })).toBe(data);
    });

    test("should encrypt and decrypt with RSA-OAEP-512", () => {
      const key = TEST_RSA_KEY.clone({ algorithm: "RSA-OAEP-512" });
      const encryption = _encryptAesData({
        data,
        kryptos: key,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP-512");
      expect(_decryptAesData({ ...encryption, kryptos: key })).toBe(data);
    });
  });
});
