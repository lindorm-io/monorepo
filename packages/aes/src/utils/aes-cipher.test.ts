import { randomBytes } from "crypto";
import { LATEST_AES_VERSION } from "../constants";
import { AesAlgorithm, AesEncryptionKeyAlgorithm, AesFormat } from "../enums";
import { decryptAesCipher, encryptAesCipher } from "./aes-cipher";
import { decodeAesString } from "./private/decode-aes-string";

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

describe("aes-cipher", () => {
  describe("algorithms", () => {
    test("should encrypt using the aes-128-gcm algorithm", () => {
      const data = randomBytes(32).toString("hex");
      const secret = randomBytes(32).toString("hex").slice(0, 16);

      const cipher = encryptAesCipher({
        algorithm: AesAlgorithm.AES_128_GCM,
        data,
        format: AesFormat.BASE64,
        secret,
      });

      expect(cipher).toStrictEqual(expect.stringContaining("$aes-128-gcm$"));

      const decoded = decodeAesString(cipher);

      expect(decoded.algorithm).toBe("aes-128-gcm");
      expect(decoded.format).toBe("base64");
      expect(decoded.version).toBe(LATEST_AES_VERSION);

      const decrypted = decryptAesCipher({ cipher, secret });

      expect(decrypted).toBe(data);
    });

    test("should encrypt using the aes-192-gcm algorithm", () => {
      const data = randomBytes(32).toString("hex");
      const secret = randomBytes(32).toString("hex").slice(0, 24);

      const cipher = encryptAesCipher({
        algorithm: AesAlgorithm.AES_192_GCM,
        data,
        format: AesFormat.BASE64,
        secret,
      });

      expect(cipher).toStrictEqual(expect.stringContaining("$aes-192-gcm$"));

      const decoded = decodeAesString(cipher);

      expect(decoded.algorithm).toBe("aes-192-gcm");
      expect(decoded.format).toBe("base64");
      expect(decoded.version).toBe(LATEST_AES_VERSION);

      const decrypted = decryptAesCipher({ cipher, secret });

      expect(decrypted).toBe(data);
    });

    test("should encrypt using the aes-256-gcm algorithm", () => {
      const data = randomBytes(32).toString("hex");
      const secret = randomBytes(32).toString("hex").slice(0, 32);

      const cipher = encryptAesCipher({
        algorithm: AesAlgorithm.AES_256_GCM,
        data,
        format: AesFormat.BASE64,
        secret,
      });

      expect(cipher).toStrictEqual(expect.stringContaining("$aes-256-gcm$"));

      const decoded = decodeAesString(cipher);

      expect(decoded.algorithm).toBe("aes-256-gcm");
      expect(decoded.format).toBe("base64");
      expect(decoded.version).toBe(LATEST_AES_VERSION);

      const decrypted = decryptAesCipher({ cipher, secret });

      expect(decrypted).toBe(data);
    });
  });

  describe("formats", () => {
    test("should encrypt and format the string content to base64", () => {
      const data = randomBytes(32).toString("base64");
      const secret = randomBytes(32).toString("base64").slice(0, 32);

      const cipher = encryptAesCipher({
        algorithm: AesAlgorithm.AES_256_GCM,
        data,
        format: AesFormat.BASE64,
        secret,
      });

      expect(cipher).toStrictEqual(expect.stringContaining("$aes-256-gcm$"));

      const decoded = decodeAesString(cipher);

      expect(decoded.algorithm).toBe("aes-256-gcm");
      expect(decoded.format).toBe("base64");
      expect(decoded.version).toBe(LATEST_AES_VERSION);

      const decrypted = decryptAesCipher({ cipher, secret });

      expect(decrypted).toBe(data);
    });

    test("should encrypt and format the string content to base64url", () => {
      const data = randomBytes(32).toString("base64url");
      const secret = randomBytes(32).toString("base64url").slice(0, 32);

      const cipher = encryptAesCipher({
        algorithm: AesAlgorithm.AES_256_GCM,
        data,
        format: AesFormat.BASE64_URL,
        secret,
      });

      expect(cipher).toStrictEqual(expect.stringContaining("$aes-256-gcm$"));

      const decoded = decodeAesString(cipher);

      expect(decoded.algorithm).toBe("aes-256-gcm");
      expect(decoded.format).toBe("base64url");
      expect(decoded.version).toBe(LATEST_AES_VERSION);

      const decrypted = decryptAesCipher({ cipher, secret });

      expect(decrypted).toBe(data);
    });

    test("should encrypt and format the string content to hex", () => {
      const data = randomBytes(32).toString("hex");
      const secret = randomBytes(32).toString("hex").slice(0, 32);

      const cipher = encryptAesCipher({
        algorithm: AesAlgorithm.AES_256_GCM,
        data,
        format: AesFormat.HEX,
        secret,
      });

      expect(cipher).toStrictEqual(expect.stringContaining("$aes-256-gcm$"));

      const decoded = decodeAesString(cipher);

      expect(decoded.algorithm).toBe("aes-256-gcm");
      expect(decoded.format).toBe("hex");
      expect(decoded.version).toBe(LATEST_AES_VERSION);

      const decrypted = decryptAesCipher({ cipher, secret });

      expect(decrypted).toBe(data);
    });
  });

  describe("encryption and decryption", () => {
    test("should encrypt using an rsa private key", () => {
      const data = randomBytes(32).toString("hex");

      const cipher = encryptAesCipher({
        data,
        key: PRIVATE_KEY,
        keyId: "0acfb2a3-5cd6-5911-8a8f-e3aca6465090",
      });

      expect(cipher).toStrictEqual(expect.stringContaining("$aes-256-gcm$"));

      const decoded = decodeAesString(cipher);

      expect(decoded.algorithm).toBe("aes-256-gcm");
      expect(decoded.format).toBe("base64");
      expect(decoded.keyId).toStrictEqual(Buffer.from("0acfb2a3-5cd6-5911-8a8f-e3aca6465090"));
      expect(decoded.encryptionKeyAlgorithm).toBeUndefined();
      expect(decoded.publicEncryptionKey).toStrictEqual(expect.any(Buffer));
      expect(decoded.version).toBe(LATEST_AES_VERSION);

      const decrypted = decryptAesCipher({ cipher, key: PUBLIC_KEY });

      expect(decrypted).toBe(data);
    });

    test("should encrypt using an rsa public key with sha256", () => {
      const data = randomBytes(32).toString("hex");

      const cipher = encryptAesCipher({
        data,
        key: PUBLIC_KEY,
        keyId: "0acfb2a3-5cd6-5911-8a8f-e3aca6465090",
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.SHA256,
      });

      expect(cipher).toStrictEqual(expect.stringContaining("$aes-256-gcm$"));

      const decoded = decodeAesString(cipher);

      expect(decoded.algorithm).toBe("aes-256-gcm");
      expect(decoded.format).toBe("base64");
      expect(decoded.keyId).toStrictEqual(Buffer.from("0acfb2a3-5cd6-5911-8a8f-e3aca6465090"));
      expect(decoded.encryptionKeyAlgorithm).toBe(AesEncryptionKeyAlgorithm.SHA256);
      expect(decoded.publicEncryptionKey).toStrictEqual(expect.any(Buffer));
      expect(decoded.version).toBe(LATEST_AES_VERSION);

      const decrypted = decryptAesCipher({ cipher, key: PRIVATE_KEY });

      expect(decrypted).toBe(data);
    });

    test("should encrypt using an rsa public key with sha384", () => {
      const data = randomBytes(32).toString("hex");

      const cipher = encryptAesCipher({
        data,
        key: PUBLIC_KEY,
        keyId: "0acfb2a3-5cd6-5911-8a8f-e3aca6465090",
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.SHA384,
      });

      expect(cipher).toStrictEqual(expect.stringContaining("$aes-256-gcm$"));

      const decoded = decodeAesString(cipher);

      expect(decoded.algorithm).toBe("aes-256-gcm");
      expect(decoded.format).toBe("base64");
      expect(decoded.keyId).toStrictEqual(Buffer.from("0acfb2a3-5cd6-5911-8a8f-e3aca6465090"));
      expect(decoded.encryptionKeyAlgorithm).toBe(AesEncryptionKeyAlgorithm.SHA384);
      expect(decoded.publicEncryptionKey).toStrictEqual(expect.any(Buffer));
      expect(decoded.version).toBe(LATEST_AES_VERSION);

      const decrypted = decryptAesCipher({ cipher, key: PRIVATE_KEY });

      expect(decrypted).toBe(data);
    });

    test("should encrypt using an rsa public key with sha512", () => {
      const data = randomBytes(32).toString("hex");

      const cipher = encryptAesCipher({
        data,
        key: PUBLIC_KEY,
        keyId: "0acfb2a3-5cd6-5911-8a8f-e3aca6465090",
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.SHA512,
      });

      expect(cipher).toStrictEqual(expect.stringContaining("$aes-256-gcm$"));

      const decoded = decodeAesString(cipher);

      expect(decoded.algorithm).toBe("aes-256-gcm");
      expect(decoded.format).toBe("base64");
      expect(decoded.keyId).toStrictEqual(Buffer.from("0acfb2a3-5cd6-5911-8a8f-e3aca6465090"));
      expect(decoded.encryptionKeyAlgorithm).toBe(AesEncryptionKeyAlgorithm.SHA512);
      expect(decoded.publicEncryptionKey).toStrictEqual(expect.any(Buffer));
      expect(decoded.version).toBe(LATEST_AES_VERSION);

      const decrypted = decryptAesCipher({ cipher, key: PRIVATE_KEY });

      expect(decrypted).toBe(data);
    });
  });
});
