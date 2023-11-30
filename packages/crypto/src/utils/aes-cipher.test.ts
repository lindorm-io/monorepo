import { randomBytes } from "crypto";
import { decryptAesCipher, encryptAesCipher } from "./aes-cipher";

describe("aes-cipher", () => {
  let secret: string;

  beforeEach(() => {
    secret = randomBytes(32).toString("hex").slice(0, 32);
  });

  describe("encrypting algorithms", () => {
    test("should create aes cipher with 128 bits", () => {
      secret = randomBytes(32).toString("hex").slice(0, 16);

      expect(
        encryptAesCipher({
          algorithm: "aes-128-gcm",
          data: "data",
          secret,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create aes cipher with 192 bits", () => {
      secret = randomBytes(32).toString("hex").slice(0, 24);

      expect(
        encryptAesCipher({
          algorithm: "aes-192-gcm",
          data: "data",
          secret,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create aes cipher with 256 bits", () => {
      expect(
        encryptAesCipher({
          algorithm: "aes-256-gcm",
          data: "data",
          secret,
        }),
      ).toStrictEqual(expect.any(String));
    });
  });

  describe("encrypting digests", () => {
    test("should create aes cipher with hex", () => {
      expect(
        encryptAesCipher({
          algorithm: "aes-256-gcm",
          data: "data",
          format: "hex",
          secret,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create aes cipher with base64", () => {
      expect(
        encryptAesCipher({
          algorithm: "aes-256-gcm",
          data: "data",
          format: "base64",
          secret,
        }),
      ).toStrictEqual(expect.any(String));
    });
  });

  describe("decrypting algorithms", () => {
    test("should decrypt 128 bit cipher", () => {
      secret = randomBytes(32).toString("hex").slice(0, 16);

      const cipher = encryptAesCipher({
        algorithm: "aes-128-gcm",
        data: "data",
        secret,
      });

      expect(
        decryptAesCipher({
          algorithm: "aes-128-gcm",
          cipher,
          secret,
        }),
      ).toBe("data");
    });

    test("should decrypt 192 bit cipher", () => {
      secret = randomBytes(32).toString("hex").slice(0, 24);

      const cipher = encryptAesCipher({
        algorithm: "aes-192-gcm",
        data: "data",
        secret,
      });

      expect(
        decryptAesCipher({
          algorithm: "aes-192-gcm",
          cipher,
          secret,
        }),
      ).toBe("data");
    });

    test("should decrypt 256 bit cipher", () => {
      const cipher = encryptAesCipher({
        algorithm: "aes-256-gcm",
        data: "data",
        secret,
      });

      expect(
        decryptAesCipher({
          algorithm: "aes-256-gcm",
          cipher,
          secret,
        }),
      ).toBe("data");
    });
  });

  describe("decrypting digests", () => {
    test("should decrypt aes cipher with hex", () => {
      const cipher = encryptAesCipher({
        algorithm: "aes-256-gcm",
        data: "data",
        format: "hex",
        secret,
      });

      expect(
        decryptAesCipher({
          algorithm: "aes-256-gcm",
          cipher,
          format: "hex",
          secret,
        }),
      ).toBe("data");
    });

    test("should decrypt aes cipher with base64", () => {
      const cipher = encryptAesCipher({
        algorithm: "aes-256-gcm",
        data: "data",
        format: "base64",
        secret,
      });

      expect(
        decryptAesCipher({
          algorithm: "aes-256-gcm",
          cipher,
          format: "base64",
          secret,
        }),
      ).toBe("data");
    });
  });
});
