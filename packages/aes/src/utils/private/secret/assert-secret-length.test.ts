import { randomBytes } from "crypto";
import { AesError } from "../../../errors";
import { assertSecretLength } from "./assert-secret-length";

describe("assertSecretLength", () => {
  describe("aes-128-gcm", () => {
    test("should resolve for aes-128-gcm", () => {
      expect(() =>
        assertSecretLength({
          encryption: "aes-128-gcm",
          secret: randomBytes(32).toString("hex").slice(0, 16),
        }),
      ).not.toThrow();
    });

    test("should throw for aes-128-gcm", () => {
      expect(() =>
        assertSecretLength({
          encryption: "aes-128-gcm",
          secret: randomBytes(32).toString("hex").slice(0, 15),
        }),
      ).toThrow(AesError);
    });
  });

  describe("aes-192-gcm", () => {
    test("should resolve for aes-192-gcm", () => {
      expect(() =>
        assertSecretLength({
          encryption: "aes-192-gcm",
          secret: randomBytes(32).toString("hex").slice(0, 24),
        }),
      ).not.toThrow();
    });

    test("should throw for aes-192-gcm", () => {
      expect(() =>
        assertSecretLength({
          encryption: "aes-192-gcm",
          secret: randomBytes(32).toString("hex").slice(0, 23),
        }),
      ).toThrow(AesError);
    });
  });

  describe("aes-256-gcm", () => {
    test("should resolve for aes-256-gcm", () => {
      expect(() =>
        assertSecretLength({
          encryption: "aes-256-gcm",
          secret: randomBytes(32).toString("hex").slice(0, 32),
        }),
      ).not.toThrow();
    });

    test("should throw for aes-256-gcm", () => {
      expect(() =>
        assertSecretLength({
          encryption: "aes-256-gcm",
          secret: randomBytes(32).toString("hex").slice(0, 31),
        }),
      ).toThrow(AesError);
    });
  });
});
