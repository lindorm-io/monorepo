import { randomBytes } from "crypto";
import { AesAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { assertAesCipherSecret } from "./assert-aes-cipher-secret";

describe("assertAesCipherSecret", () => {
  describe("aes-128-gcm", () => {
    test("should resolve for aes-128-gcm", () => {
      expect(() =>
        assertAesCipherSecret(
          randomBytes(32).toString("hex").slice(0, 16),
          AesAlgorithm.AES_128_GCM,
        ),
      ).not.toThrow();
    });

    test("should throw for aes-128-gcm", () => {
      expect(() =>
        assertAesCipherSecret(
          randomBytes(32).toString("hex").slice(0, 15),
          AesAlgorithm.AES_128_GCM,
        ),
      ).toThrow(AesError);
    });
  });

  describe("aes-192-gcm", () => {
    test("should resolve for aes-192-gcm", () => {
      expect(() =>
        assertAesCipherSecret(
          randomBytes(32).toString("hex").slice(0, 24),
          AesAlgorithm.AES_192_GCM,
        ),
      ).not.toThrow();
    });

    test("should throw for aes-192-gcm", () => {
      expect(() =>
        assertAesCipherSecret(
          randomBytes(32).toString("hex").slice(0, 23),
          AesAlgorithm.AES_192_GCM,
        ),
      ).toThrow(AesError);
    });
  });

  describe("aes-256-gcm", () => {
    test("should resolve for aes-256-gcm", () => {
      expect(() =>
        assertAesCipherSecret(
          randomBytes(32).toString("hex").slice(0, 32),
          AesAlgorithm.AES_256_GCM,
        ),
      ).not.toThrow();
    });

    test("should throw for aes-256-gcm", () => {
      expect(() =>
        assertAesCipherSecret(
          randomBytes(32).toString("hex").slice(0, 31),
          AesAlgorithm.AES_256_GCM,
        ),
      ).toThrow(AesError);
    });
  });
});
