import { randomBytes } from "crypto";
import { EC_KEY_SET } from "../fixtures/ec-keys.fixture";
import { OCT_KEY_SET } from "../fixtures/oct-keys.fixture";
import { RSA_KEY_SET } from "../fixtures/rsa-keys.fixture";
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
      encryption: "aes-256-gcm",
      authTag: expect.any(Buffer),
      content: expect.any(Buffer),
      encryptionKeyAlgorithm: undefined,
      format: "base64url",
      initialisationVector: expect.any(Buffer),
      integrityHash: undefined,
      keyId: expect.any(Buffer),
      publicEncryptionJwk: undefined,
      publicEncryptionKey: undefined,
      version: 5,
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
        encryption: "aes-128-cbc",
        data,
        secret,
      });

      expect(encryption.encryption).toBe("aes-128-cbc");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });

    test("should encrypt and decrypt with aes-192-cbc", () => {
      secret = randomBytes(12).toString("hex");

      const encryption = encryptAesData({
        encryption: "aes-192-cbc",
        data,
        secret,
      });

      expect(encryption.encryption).toBe("aes-192-cbc");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });

    test("should encrypt and decrypt with aes-256-cbc", () => {
      const encryption = encryptAesData({
        encryption: "aes-256-cbc",
        data,
        secret,
      });

      expect(encryption.encryption).toBe("aes-256-cbc");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });

    test("should encrypt and decrypt with integrity algorithm", () => {
      const encryption = encryptAesData({
        encryption: "aes-256-cbc",
        data,
        integrityHash: "sha256",
        secret,
      });

      expect(encryption.encryption).toBe("aes-256-cbc");
      expect(encryption.authTag).toStrictEqual(expect.any(Buffer));
      expect(encryption.integrityHash).toBe("sha256");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });
  });

  describe("gcm", () => {
    test("should encrypt and decrypt with aes-128-gcm", () => {
      secret = randomBytes(8).toString("hex");

      const encryption = encryptAesData({
        encryption: "aes-128-gcm",
        data,
        secret,
      });

      expect(encryption.encryption).toBe("aes-128-gcm");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });

    test("should encrypt and decrypt with aes-192-gcm", () => {
      secret = randomBytes(12).toString("hex");

      const encryption = encryptAesData({
        encryption: "aes-192-gcm",
        data,
        secret,
      });

      expect(encryption.encryption).toBe("aes-192-gcm");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });

    test("should encrypt and decrypt with aes-256-gcm", () => {
      const encryption = encryptAesData({
        encryption: "aes-256-gcm",
        data,
        secret,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });
  });

  describe("formats", () => {
    test("should encrypt and decrypt with base64", () => {
      const encryption = encryptAesData({
        data,
        format: "base64",
        secret,
      });

      expect(encryption.format).toBe("base64");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });

    test("should encrypt and decrypt with base64url", () => {
      const encryption = encryptAesData({
        data,
        format: "base64url",
        secret,
      });

      expect(encryption.format).toBe("base64url");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });

    test("should encrypt and decrypt with hex", () => {
      const encryption = encryptAesData({
        data,
        format: "hex",
        secret,
      });

      expect(encryption.format).toBe("hex");
      expect(decryptAesData({ ...encryption, secret })).toBe(data);
    });
  });

  describe("ec", () => {
    test("should encrypt and decrypt using key set", () => {
      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "ECDH-ES",
        keySet: EC_KEY_SET,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe(undefined);
      expect(decryptAesData({ ...encryption, keySet: EC_KEY_SET })).toBe(data);
    });

    test("should encrypt and decrypt using der key", () => {
      const key = EC_KEY_SET.export("der");

      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "ECDH-ES",
        key,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe(undefined);
      expect(decryptAesData({ ...encryption, key })).toBe(data);
    });

    test("should encrypt and decrypt using jwk key", () => {
      const key = EC_KEY_SET.export("jwk");

      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "ECDH-ES",
        key,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe(undefined);
      expect(decryptAesData({ ...encryption, key })).toBe(data);
    });

    test("should encrypt and decrypt using pem key", () => {
      const key = EC_KEY_SET.export("pem");

      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "ECDH-ES",
        key,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe(undefined);
      expect(decryptAesData({ ...encryption, key })).toBe(data);
    });
  });

  describe("oct", () => {
    test("should encrypt and decrypt using key set", () => {
      const encryption = encryptAesData({
        data,
        keySet: OCT_KEY_SET,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe(undefined);
      expect(decryptAesData({ ...encryption, keySet: OCT_KEY_SET })).toBe(data);
    });

    test("should encrypt and decrypt using der key", () => {
      const key = OCT_KEY_SET.export("der");

      const encryption = encryptAesData({
        data,
        key,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe(undefined);
      expect(decryptAesData({ ...encryption, key })).toBe(data);
    });

    test("should encrypt and decrypt using jwk key", () => {
      const key = OCT_KEY_SET.export("jwk");

      const encryption = encryptAesData({
        data,
        key,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe(undefined);
      expect(decryptAesData({ ...encryption, key })).toBe(data);
    });

    test("should encrypt and decrypt using pem key", () => {
      const key = OCT_KEY_SET.export("pem");

      const encryption = encryptAesData({
        data,
        key,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe(undefined);
      expect(decryptAesData({ ...encryption, key })).toBe(data);
    });
  });

  describe("rsa", () => {
    test("should encrypt and decrypt using key set", () => {
      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "RSA-PRIVATE-KEY",
        keySet: RSA_KEY_SET,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-PRIVATE-KEY");
      expect(decryptAesData({ ...encryption, keySet: RSA_KEY_SET })).toBe(data);
    });

    test("should encrypt and decrypt using der key", () => {
      const key = RSA_KEY_SET.export("der");

      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "RSA-PRIVATE-KEY",
        key,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-PRIVATE-KEY");
      expect(decryptAesData({ ...encryption, key })).toBe(data);
    });

    test("should encrypt and decrypt using jwk key", () => {
      const key = RSA_KEY_SET.export("jwk");

      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "RSA-PRIVATE-KEY",
        key,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-PRIVATE-KEY");
      expect(decryptAesData({ ...encryption, key })).toBe(data);
    });

    test("should encrypt and decrypt using pem key", () => {
      const key = RSA_KEY_SET.export("pem");

      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "RSA-PRIVATE-KEY",
        key,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-PRIVATE-KEY");
      expect(decryptAesData({ ...encryption, key })).toBe(data);
    });

    test("should encrypt and decrypt with RSA-PRIVATE-KEY", () => {
      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "RSA-PRIVATE-KEY",
        keySet: RSA_KEY_SET,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-PRIVATE-KEY");
      expect(decryptAesData({ ...encryption, keySet: RSA_KEY_SET })).toBe(data);
    });

    test("should encrypt and decrypt with RSA-OAEP", () => {
      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "RSA-OAEP",
        keySet: RSA_KEY_SET,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP");
      expect(decryptAesData({ ...encryption, keySet: RSA_KEY_SET })).toBe(data);
    });

    test("should encrypt and decrypt with RSA-OAEP-256", () => {
      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "RSA-OAEP-256",
        keySet: RSA_KEY_SET,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP-256");
      expect(decryptAesData({ ...encryption, keySet: RSA_KEY_SET })).toBe(data);
    });

    test("should encrypt and decrypt with RSA-OAEP-384", () => {
      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "RSA-OAEP-384",
        keySet: RSA_KEY_SET,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP-384");
      expect(decryptAesData({ ...encryption, keySet: RSA_KEY_SET })).toBe(data);
    });

    test("should encrypt and decrypt with RSA-OAEP-512", () => {
      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "RSA-OAEP-512",
        keySet: RSA_KEY_SET,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP-512");
      expect(decryptAesData({ ...encryption, keySet: RSA_KEY_SET })).toBe(data);
    });
  });
});
