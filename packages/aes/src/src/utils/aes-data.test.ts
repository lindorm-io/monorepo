import { Kryptos } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { EC_KEY_SET } from "../__fixtures__/ec-keys.fixture";
import { OCT_KEY_SET } from "../__fixtures__/oct-keys.fixture";
import { RSA_KEY_SET } from "../__fixtures__/rsa-keys.fixture";
import { decryptAesData, encryptAesData } from "./aes-data";

describe("aes-data", () => {
  let data: string;
  let kryptos: Kryptos;

  beforeEach(async () => {
    data = randomBytes(32).toString("hex");
    kryptos = await Kryptos.generate("oct");
  });

  test("should encrypt", () => {
    expect(encryptAesData({ data, kryptos })).toStrictEqual({
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
      version: 6,
    });
  });

  test("should decrypt", () => {
    const encryption = encryptAesData({ data, kryptos });

    expect(decryptAesData({ ...encryption, kryptos })).toBe(data);
  });

  describe("cbc", () => {
    test("should encrypt and decrypt with aes-128-cbc", () => {
      const encryption = encryptAesData({
        encryption: "aes-128-cbc",
        data,
        kryptos,
      });

      expect(encryption.encryption).toBe("aes-128-cbc");
      expect(decryptAesData({ ...encryption, kryptos })).toBe(data);
    });

    test("should encrypt and decrypt with aes-192-cbc", () => {
      const encryption = encryptAesData({
        encryption: "aes-192-cbc",
        data,
        kryptos,
      });

      expect(encryption.encryption).toBe("aes-192-cbc");
      expect(decryptAesData({ ...encryption, kryptos })).toBe(data);
    });

    test("should encrypt and decrypt with aes-256-cbc", () => {
      const encryption = encryptAesData({
        encryption: "aes-256-cbc",
        data,
        kryptos,
      });

      expect(encryption.encryption).toBe("aes-256-cbc");
      expect(decryptAesData({ ...encryption, kryptos })).toBe(data);
    });

    test("should encrypt and decrypt with integrity algorithm", () => {
      const encryption = encryptAesData({
        encryption: "aes-256-cbc",
        data,
        integrityHash: "sha256",
        kryptos,
      });

      expect(encryption.encryption).toBe("aes-256-cbc");
      expect(encryption.authTag).toStrictEqual(expect.any(Buffer));
      expect(encryption.integrityHash).toBe("sha256");
      expect(decryptAesData({ ...encryption, kryptos })).toBe(data);
    });
  });

  describe("gcm", () => {
    test("should encrypt and decrypt with aes-128-gcm", () => {
      const encryption = encryptAesData({
        encryption: "aes-128-gcm",
        data,
        kryptos,
      });

      expect(encryption.encryption).toBe("aes-128-gcm");
      expect(decryptAesData({ ...encryption, kryptos })).toBe(data);
    });

    test("should encrypt and decrypt with aes-192-gcm", () => {
      const encryption = encryptAesData({
        encryption: "aes-192-gcm",
        data,
        kryptos,
      });

      expect(encryption.encryption).toBe("aes-192-gcm");
      expect(decryptAesData({ ...encryption, kryptos })).toBe(data);
    });

    test("should encrypt and decrypt with aes-256-gcm", () => {
      const encryption = encryptAesData({
        encryption: "aes-256-gcm",
        data,
        kryptos,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(decryptAesData({ ...encryption, kryptos })).toBe(data);
    });
  });

  describe("formats", () => {
    test("should encrypt and decrypt with base64", () => {
      const encryption = encryptAesData({
        data,
        format: "base64",
        kryptos,
      });

      expect(encryption.format).toBe("base64");
      expect(decryptAesData({ ...encryption, kryptos })).toBe(data);
    });

    test("should encrypt and decrypt with base64url", () => {
      const encryption = encryptAesData({
        data,
        format: "base64url",
        kryptos,
      });

      expect(encryption.format).toBe("base64url");
      expect(decryptAesData({ ...encryption, kryptos })).toBe(data);
    });

    test("should encrypt and decrypt with hex", () => {
      const encryption = encryptAesData({
        data,
        format: "hex",
        kryptos,
      });

      expect(encryption.format).toBe("hex");
      expect(decryptAesData({ ...encryption, kryptos })).toBe(data);
    });
  });

  describe("ec", () => {
    test("should encrypt and decrypt", () => {
      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "ECDH-ES",
        kryptos: EC_KEY_SET,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe(undefined);
      expect(decryptAesData({ ...encryption, kryptos: EC_KEY_SET })).toBe(data);
    });
  });

  describe("oct", () => {
    test("should encrypt and decrypt", () => {
      const encryption = encryptAesData({
        data,
        kryptos: OCT_KEY_SET,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe(undefined);
      expect(decryptAesData({ ...encryption, kryptos: OCT_KEY_SET })).toBe(data);
    });
  });

  describe("rsa", () => {
    test("should encrypt and decrypt", () => {
      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "RSA-PRIVATE-KEY",
        kryptos: RSA_KEY_SET,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-PRIVATE-KEY");
      expect(decryptAesData({ ...encryption, kryptos: RSA_KEY_SET })).toBe(data);
    });

    test("should encrypt and decrypt with RSA-PRIVATE-KEY", () => {
      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "RSA-PRIVATE-KEY",
        kryptos: RSA_KEY_SET,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-PRIVATE-KEY");
      expect(decryptAesData({ ...encryption, kryptos: RSA_KEY_SET })).toBe(data);
    });

    test("should encrypt and decrypt with RSA-OAEP", () => {
      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "RSA-OAEP",
        kryptos: RSA_KEY_SET,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP");
      expect(decryptAesData({ ...encryption, kryptos: RSA_KEY_SET })).toBe(data);
    });

    test("should encrypt and decrypt with RSA-OAEP-256", () => {
      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "RSA-OAEP-256",
        kryptos: RSA_KEY_SET,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP-256");
      expect(decryptAesData({ ...encryption, kryptos: RSA_KEY_SET })).toBe(data);
    });

    test("should encrypt and decrypt with RSA-OAEP-384", () => {
      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "RSA-OAEP-384",
        kryptos: RSA_KEY_SET,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP-384");
      expect(decryptAesData({ ...encryption, kryptos: RSA_KEY_SET })).toBe(data);
    });

    test("should encrypt and decrypt with RSA-OAEP-512", () => {
      const encryption = encryptAesData({
        data,
        encryptionKeyAlgorithm: "RSA-OAEP-512",
        kryptos: RSA_KEY_SET,
      });

      expect(encryption.encryption).toBe("aes-256-gcm");
      expect(encryption.encryptionKeyAlgorithm).toBe("RSA-OAEP-512");
      expect(decryptAesData({ ...encryption, kryptos: RSA_KEY_SET })).toBe(data);
    });
  });
});
