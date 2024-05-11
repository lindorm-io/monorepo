import { randomBytes } from "crypto";
import { RSA_KEYS } from "../../__fixtures__/rsa-keys.fixture";
import { RsaError } from "../../errors";
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
          kryptos: RSA_KEYS,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature with RSA_SHA384", () => {
      expect(
        createRsaSignature({
          algorithm: "RSA-SHA384",
          kryptos: RSA_KEYS,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature with RSA_SHA512", () => {
      expect(
        createRsaSignature({
          algorithm: "RSA-SHA512",
          kryptos: RSA_KEYS,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature with SHA256", () => {
      expect(
        createRsaSignature({
          algorithm: "sha256",
          kryptos: RSA_KEYS,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature with SHA384", () => {
      expect(
        createRsaSignature({
          algorithm: "sha384",
          kryptos: RSA_KEYS,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature with SHA512", () => {
      expect(
        createRsaSignature({
          algorithm: "sha512",
          kryptos: RSA_KEYS,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });
  });

  describe("formats", () => {
    test("should create signature at base64 digest", () => {
      expect(
        createRsaSignature({
          kryptos: RSA_KEYS,
          data,
          format: "base64",
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature at base64url digest", () => {
      expect(
        createRsaSignature({
          kryptos: RSA_KEYS,
          data,
          format: "base64url",
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature at hex digest", () => {
      expect(
        createRsaSignature({
          kryptos: RSA_KEYS,
          data,
          format: "hex",
        }),
      ).toStrictEqual(expect.any(String));
    });
  });

  describe("verify", () => {
    test("should verify signature", () => {
      const signature = createRsaSignature({
        kryptos: RSA_KEYS,
        data,
      });

      expect(
        verifyRsaSignature({
          data,
          kryptos: RSA_KEYS,
          signature,
        }),
      ).toBe(true);
    });
  });

  describe("assert", () => {
    test("should assert signature", () => {
      const signature = createRsaSignature({
        kryptos: RSA_KEYS,
        data,
      });

      expect(() =>
        assertRsaSignature({
          data,
          kryptos: RSA_KEYS,
          signature,
        }),
      ).not.toThrow();
    });

    test("should throw error on invalid signature", () => {
      const signature = createRsaSignature({
        kryptos: RSA_KEYS,
        data,
      });

      expect(() =>
        assertRsaSignature({
          data: "invalid",
          kryptos: RSA_KEYS,
          signature,
        }),
      ).toThrow(RsaError);
    });
  });
});
