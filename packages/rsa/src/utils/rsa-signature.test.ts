import { randomBytes } from "crypto";
import { RsaError } from "../errors";
import { RSA_KEY_SET } from "../fixtures/rsa-keys.fixture";
import { assertRsaSignature, createRsaSignature, verifyRsaSignature } from "./rsa-signature";

describe("rsa-signature", () => {
  let data: string;

  beforeEach(() => {
    data = randomBytes(32).toString("hex");
  });

  describe("algorithms", () => {
    test("should create signature with RSA_SHA256", () => {
      expect(
        createRsaSignature({
          algorithm: "RSA-SHA256",
          keySet: RSA_KEY_SET,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature with RSA_SHA384", () => {
      expect(
        createRsaSignature({
          algorithm: "RSA-SHA384",
          keySet: RSA_KEY_SET,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature with RSA_SHA512", () => {
      expect(
        createRsaSignature({
          algorithm: "RSA-SHA512",
          keySet: RSA_KEY_SET,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature with SHA256", () => {
      expect(
        createRsaSignature({
          algorithm: "sha256",
          keySet: RSA_KEY_SET,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature with SHA384", () => {
      expect(
        createRsaSignature({
          algorithm: "sha384",
          keySet: RSA_KEY_SET,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature with SHA512", () => {
      expect(
        createRsaSignature({
          algorithm: "sha512",
          keySet: RSA_KEY_SET,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });
  });

  describe("formats", () => {
    test("should create signature at base64 digest", () => {
      expect(
        createRsaSignature({
          keySet: RSA_KEY_SET,
          data,
          format: "base64",
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature at base64url digest", () => {
      expect(
        createRsaSignature({
          keySet: RSA_KEY_SET,
          data,
          format: "base64url",
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature at hex digest", () => {
      expect(
        createRsaSignature({
          keySet: RSA_KEY_SET,
          data,
          format: "hex",
        }),
      ).toStrictEqual(expect.any(String));
    });
  });

  describe("verify", () => {
    test("should verify signature", () => {
      const signature = createRsaSignature({
        keySet: RSA_KEY_SET,
        data,
      });

      expect(
        verifyRsaSignature({
          data,
          keySet: RSA_KEY_SET,
          signature,
        }),
      ).toBe(true);
    });
  });

  describe("assert", () => {
    test("should assert signature", () => {
      const signature = createRsaSignature({
        keySet: RSA_KEY_SET,
        data,
      });

      expect(() =>
        assertRsaSignature({
          data,
          keySet: RSA_KEY_SET,
          signature,
        }),
      ).not.toThrow();
    });

    test("should throw error on invalid signature", () => {
      const signature = createRsaSignature({
        keySet: RSA_KEY_SET,
        data,
      });

      expect(() =>
        assertRsaSignature({
          data: "invalid",
          keySet: RSA_KEY_SET,
          signature,
        }),
      ).toThrow(RsaError);
    });
  });
});
