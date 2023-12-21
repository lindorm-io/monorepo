import { randomBytes } from "crypto";
import {
  AesAlgorithm,
  AesEncryptionKeyAlgorithm,
  AesFormat,
  AesIntegrityAlgorithm,
} from "../enums";
import { decryptAesData, encryptAesData } from "./aes-data";

const PRIVATE_KEY =
  "-----BEGIN RSA PRIVATE KEY-----\n" +
  "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\n" +
  "-----END RSA PRIVATE KEY-----\n";

const PUBLIC_KEY =
  "-----BEGIN RSA PUBLIC KEY-----\n" +
  "MIICCgKCAgEA8h//VGbmGCMm/cywfEEviNkR7o3yL0yZktzqb95VtwsGatj3JbOp\n" +
  "u7FwePJww0CBVZw3zE+bnNcVyaZFMfhm8uNEBOA5JQBWs2ZJhflIGz4oYWcWeMto\n" +
  "cwh0kNVLtz1071a9O7JOAVR64KslbactXAeSIcMk7c9reKffVgymZnTTNHMhECtb\n" +
  "z77RCUpgLgEG/PUU44N9cYWtPfOvUnxrA6ocxG8Y+IggG6TYtiDwTBScypg9u59/\n" +
  "xLLevM+SRwGomM3dyx6h4W3DnT8kwIRrBvsNhmmqoMEOjQYPbfVHP/RkES9pdIFy\n" +
  "2jdw4TrLFhwU9dSgQLpZ5EK+7CylcbdhgNqo/Bm0XgiKFKPeYvspNXXVuaVRGhop\n" +
  "z3HmEQyaCrDjvX7GF4BJ4j26rotqKxurZDNOEKuLUWwRle/Ft6/zbbrUXdV2rBvr\n" +
  "mx+YW8aKJiUpJhgT8rSRZeLZ/CJ+G8ZONp2bqvZqkeRhg3XcvyrBcdeT947FOFz5\n" +
  "wZg8mnBNnDJeVs+kdUh9FP3q0T/DVcf0ebED2pxhMjmAq7oa+Gk5UPU61+EdP9pC\n" +
  "sJrjyzu7watHSkszd8MetQ8MRUWzhplnsFJI16AKvNN03FWNk2eTd36Tzm/7SX8I\n" +
  "FDpORQUua2TivVRvRWWpl6wC0w7/oajFii+iDDdA4h4BjPAgvjmx38cCAwEAAQ==\n" +
  "-----END RSA PUBLIC KEY-----\n";

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
        key: { key: PRIVATE_KEY, type: "RSA" },
      });

      expect(encryption.algorithm).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe(undefined);
      expect(decryptAesData({ ...encryption, key: { key: PUBLIC_KEY, type: "RSA" } })).toBe(data);
    });

    test("should encrypt and decrypt with public key and RSA-OAEP", () => {
      const encryption = encryptAesData({
        data,
        key: { key: PUBLIC_KEY, type: "RSA" },
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP,
      });

      expect(encryption.algorithm).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP");
      expect(decryptAesData({ ...encryption, key: { key: PRIVATE_KEY, type: "RSA" } })).toBe(data);
    });

    test("should encrypt and decrypt with public key and RSA-OAEP-256", () => {
      const encryption = encryptAesData({
        data,
        key: { key: PUBLIC_KEY, type: "RSA" },
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_256,
      });

      expect(encryption.algorithm).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP-256");
      expect(decryptAesData({ ...encryption, key: { key: PRIVATE_KEY, type: "RSA" } })).toBe(data);
    });

    test("should encrypt and decrypt with public key and RSA-OAEP-384", () => {
      const encryption = encryptAesData({
        data,
        key: { key: PUBLIC_KEY, type: "RSA" },
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_384,
      });

      expect(encryption.algorithm).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP-384");
      expect(decryptAesData({ ...encryption, key: { key: PRIVATE_KEY, type: "RSA" } })).toBe(data);
    });

    test("should encrypt and decrypt with public key and RSA-OAEP-512", () => {
      const encryption = encryptAesData({
        data,
        key: { key: PUBLIC_KEY, type: "RSA" },
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_512,
      });

      expect(encryption.algorithm).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP-512");
      expect(decryptAesData({ ...encryption, key: { key: PRIVATE_KEY, type: "RSA" } })).toBe(data);
    });
  });
});
