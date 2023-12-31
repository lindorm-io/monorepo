import { randomBytes } from "crypto";
import { EC_KEY_SET } from "../../fixtures/ec-keys.fixture";
import { RSA_KEY_SET } from "../../fixtures/rsa-keys.fixture";
import { decryptJwe, encryptJwe } from "./jwe";

describe("jwe", () => {
  test("should encrypt and decrypt using default values", () => {
    const data = randomBytes(32).toString("hex");
    const jwe = encryptJwe({
      keySet: RSA_KEY_SET,
      token: data,
    });

    expect(
      decryptJwe({
        jwe,
        keySet: RSA_KEY_SET,
      }),
    ).toBe(data);
  });

  describe("algorithsm", () => {
    test("should encrypt and decrypt using aes-128-cbc-hs256", () => {
      const data = randomBytes(32).toString("hex");
      const jwe = encryptJwe({
        encryption: "aes-128-cbc",
        keySet: RSA_KEY_SET,
        token: data,
      });

      expect(
        decryptJwe({
          jwe,
          keySet: RSA_KEY_SET,
        }),
      ).toBe(data);
    });

    test("should encrypt and decrypt using aes-192-cbc-hs256", () => {
      const data = randomBytes(32).toString("hex");
      const jwe = encryptJwe({
        encryption: "aes-192-cbc",
        keySet: RSA_KEY_SET,
        token: data,
      });

      expect(
        decryptJwe({
          jwe,
          keySet: RSA_KEY_SET,
        }),
      ).toBe(data);
    });

    test("should encrypt and decrypt using aes-256-cbc-hs256", () => {
      const data = randomBytes(32).toString("hex");
      const jwe = encryptJwe({
        encryption: "aes-256-cbc",
        keySet: RSA_KEY_SET,
        token: data,
      });

      expect(
        decryptJwe({
          jwe,
          keySet: RSA_KEY_SET,
        }),
      ).toBe(data);
    });

    test("should encrypt and decrypt using aes-128-gcm", () => {
      const data = randomBytes(32).toString("hex");
      const jwe = encryptJwe({
        encryption: "aes-128-gcm",
        keySet: RSA_KEY_SET,
        token: data,
      });

      expect(
        decryptJwe({
          jwe,
          keySet: RSA_KEY_SET,
        }),
      ).toBe(data);
    });

    test("should encrypt and decrypt using aes-192-gcm", () => {
      const data = randomBytes(32).toString("hex");
      const jwe = encryptJwe({
        encryption: "aes-192-gcm",
        keySet: RSA_KEY_SET,
        token: data,
      });

      expect(
        decryptJwe({
          jwe,
          keySet: RSA_KEY_SET,
        }),
      ).toBe(data);
    });

    test("should encrypt and decrypt using aes-256-gcm", () => {
      const data = randomBytes(32).toString("hex");
      const jwe = encryptJwe({
        encryption: "aes-256-gcm",
        keySet: RSA_KEY_SET,
        token: data,
      });

      expect(
        decryptJwe({
          jwe,
          keySet: RSA_KEY_SET,
        }),
      ).toBe(data);
    });
  });

  describe("encryption keys", () => {
    test("should encrypt and decrypt using ECDH-ES", () => {
      const data = randomBytes(32).toString("hex");
      const jwe = encryptJwe({
        encryption: "aes-128-gcm",
        encryptionKeyAlgorithm: "ECDH-ES",
        keySet: EC_KEY_SET,
        token: data,
      });

      expect(
        decryptJwe({
          jwe,
          keySet: EC_KEY_SET,
        }),
      ).toBe(data);
    });

    test("should encrypt and decrypt using RSA-OAEP", () => {
      const data = randomBytes(32).toString("hex");
      const jwe = encryptJwe({
        encryption: "aes-128-gcm",
        encryptionKeyAlgorithm: "RSA-OAEP",
        keySet: RSA_KEY_SET,
        token: data,
      });

      expect(
        decryptJwe({
          jwe,
          keySet: RSA_KEY_SET,
        }),
      ).toBe(data);
    });

    test("should encrypt and decrypt using RSA-OAEP-256", () => {
      const data = randomBytes(32).toString("hex");
      const jwe = encryptJwe({
        encryption: "aes-128-gcm",
        encryptionKeyAlgorithm: "RSA-OAEP-256",
        keySet: RSA_KEY_SET,
        token: data,
      });

      expect(
        decryptJwe({
          jwe,
          keySet: RSA_KEY_SET,
        }),
      ).toBe(data);
    });

    test("should encrypt and decrypt using RSA-OAEP-384", () => {
      const data = randomBytes(32).toString("hex");
      const jwe = encryptJwe({
        encryption: "aes-128-gcm",
        encryptionKeyAlgorithm: "RSA-OAEP-384",
        keySet: RSA_KEY_SET,
        token: data,
      });

      expect(
        decryptJwe({
          jwe,
          keySet: RSA_KEY_SET,
        }),
      ).toBe(data);
    });

    test("should encrypt and decrypt using RSA-OAEP-512", () => {
      const data = randomBytes(32).toString("hex");
      const jwe = encryptJwe({
        encryption: "aes-128-gcm",
        encryptionKeyAlgorithm: "RSA-OAEP-512",
        keySet: RSA_KEY_SET,
        token: data,
      });

      expect(
        decryptJwe({
          jwe,
          keySet: RSA_KEY_SET,
        }),
      ).toBe(data);
    });
  });
});
