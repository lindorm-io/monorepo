import { randomBytes } from "crypto";
import {
  AesAlgorithm,
  AesEncryptionKeyAlgorithm,
  AesFormat,
  AesIntegrityAlgorithm,
} from "../enums";
import { PRIVATE_RSA_PEM, PUBLIC_RSA_PEM } from "../fixtures/rsa-keys.fixture";
import { decryptAesData, encryptAesData } from "./aes-data";

describe("aes-data", () => {
  let data: string;
  let secret: string;

  beforeEach(() => {
    data = randomBytes(32).toString("hex");
    secret = randomBytes(16).toString("hex");
  });

  test("should encrypt", () => {
    expect(encryptAesData({ data, secret })).toStrictEqual({
      algorithm: "aes-256-gcm",
      authTag: expect.any(Buffer),
      content: expect.any(Buffer),
      encryptionKeyAlgorithm: undefined,
      format: "base64url",
      initialisationVector: expect.any(Buffer),
      integrityAlgorithm: undefined,
      keyId: undefined,
      publicEncryptionKey: undefined,
      version: 4,
    });
  });

  test("should decrypt", () => {
    const encryption = encryptAesData({ data, secret });

    expect(decryptAesData({ ...encryption, secret })).toBe(data);
  });

  describe("cbc", () => {
    test("should encrypt and decrypt with aes-128-cbc", () => {
      secret = randomBytes(8).toString("hex");

      const encryption = encryptAesData({
        algorithm: AesAlgorithm.AES_128_CBC,
        data,
        secret,
      });

      expect(encryption.algorithm).toBe("aes-128-cbc");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });

    test("should encrypt and decrypt with aes-192-cbc", () => {
      secret = randomBytes(12).toString("hex");

      const encryption = encryptAesData({
        algorithm: AesAlgorithm.AES_192_CBC,
        data,
        secret,
      });

      expect(encryption.algorithm).toBe("aes-192-cbc");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });

    test("should encrypt and decrypt with aes-256-cbc", () => {
      const encryption = encryptAesData({
        algorithm: AesAlgorithm.AES_256_CBC,
        data,
        secret,
      });

      expect(encryption.algorithm).toBe("aes-256-cbc");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });

    test("should encrypt and decrypt with integrity algorithm", () => {
      const encryption = encryptAesData({
        algorithm: AesAlgorithm.AES_256_CBC,
        data,
        integrityAlgorithm: AesIntegrityAlgorithm.SHA256,
        secret,
      });

      expect(encryption.algorithm).toBe("aes-256-cbc");
      expect(encryption.authTag).toStrictEqual(expect.any(Buffer));
      expect(encryption.integrityAlgorithm).toBe("sha256");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });
  });

  describe("gcm", () => {
    test("should encrypt and decrypt with aes-128-gcm", () => {
      secret = randomBytes(8).toString("hex");

      const encryption = encryptAesData({
        algorithm: AesAlgorithm.AES_128_GCM,
        data,
        secret,
      });

      expect(encryption.algorithm).toBe("aes-128-gcm");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });

    test("should encrypt and decrypt with aes-192-gcm", () => {
      secret = randomBytes(12).toString("hex");

      const encryption = encryptAesData({
        algorithm: AesAlgorithm.AES_192_GCM,
        data,
        secret,
      });

      expect(encryption.algorithm).toBe("aes-192-gcm");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });

    test("should encrypt and decrypt with aes-256-gcm", () => {
      const encryption = encryptAesData({
        algorithm: AesAlgorithm.AES_256_GCM,
        data,
        secret,
      });

      expect(encryption.algorithm).toBe("aes-256-gcm");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });
  });

  describe("formats", () => {
    test("should encrypt and decrypt with base64", () => {
      const encryption = encryptAesData({
        data,
        format: AesFormat.BASE64,
        secret,
      });

      expect(encryption.format).toBe("base64");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });

    test("should encrypt and decrypt with base64url", () => {
      const encryption = encryptAesData({
        data,
        format: AesFormat.BASE64_URL,
        secret,
      });

      expect(encryption.format).toBe("base64url");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });

    test("should encrypt and decrypt with hex", () => {
      const encryption = encryptAesData({
        data,
        format: AesFormat.HEX,
        secret,
      });

      expect(encryption.format).toBe("hex");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });
  });

  describe("rsa", () => {
    test("should encrypt and decrypt with private key", () => {
      const encryption = encryptAesData({
        data,
        key: PRIVATE_RSA_PEM,
      });

      expect(encryption.algorithm).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe(undefined);
      expect(decryptAesData({ ...encryption, key: PUBLIC_RSA_PEM })).toBe(data);
    });

    test("should encrypt and decrypt with public key and RSA-OAEP", () => {
      const encryption = encryptAesData({
        data,
        key: PUBLIC_RSA_PEM,
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP,
      });

      expect(encryption.algorithm).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP");
      expect(decryptAesData({ ...encryption, key: PRIVATE_RSA_PEM })).toBe(data);
    });

    test("should encrypt and decrypt with public key and RSA-OAEP-256", () => {
      const encryption = encryptAesData({
        data,
        key: PUBLIC_RSA_PEM,
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_256,
      });

      expect(encryption.algorithm).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP-256");
      expect(decryptAesData({ ...encryption, key: PRIVATE_RSA_PEM })).toBe(data);
    });

    test("should encrypt and decrypt with public key and RSA-OAEP-384", () => {
      const encryption = encryptAesData({
        data,
        key: PUBLIC_RSA_PEM,
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_384,
      });

      expect(encryption.algorithm).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP-384");
      expect(decryptAesData({ ...encryption, key: PRIVATE_RSA_PEM })).toBe(data);
    });

    test("should encrypt and decrypt with public key and RSA-OAEP-512", () => {
      const encryption = encryptAesData({
        data,
        key: PUBLIC_RSA_PEM,
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_512,
      });

      expect(encryption.algorithm).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP-512");
      expect(decryptAesData({ ...encryption, key: PRIVATE_RSA_PEM })).toBe(data);
    });
  });
});
