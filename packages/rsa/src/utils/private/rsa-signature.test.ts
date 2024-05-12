import { randomBytes } from "crypto";
import { TEST_RSA_KEY } from "../../__fixtures__/keys";
import { RsaError } from "../../errors";
import { _assertRsaSignature, _createRsaSignature, _verifyRsaSignature } from "./rsa-signature";

describe("rsa-signature", () => {
  let data: string;

  beforeEach(() => {
    data = randomBytes(32).toString("hex");
  });

  describe("algorithms", () => {
    test("should create signature with RSA_SHA256", () => {
      expect(
        _createRsaSignature({
          algorithm: "RSA-SHA256",
          kryptos: TEST_RSA_KEY,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature with RSA_SHA384", () => {
      expect(
        _createRsaSignature({
          algorithm: "RSA-SHA384",
          kryptos: TEST_RSA_KEY,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature with RSA_SHA512", () => {
      expect(
        _createRsaSignature({
          algorithm: "RSA-SHA512",
          kryptos: TEST_RSA_KEY,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature with SHA256", () => {
      expect(
        _createRsaSignature({
          algorithm: "sha256",
          kryptos: TEST_RSA_KEY,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature with SHA384", () => {
      expect(
        _createRsaSignature({
          algorithm: "sha384",
          kryptos: TEST_RSA_KEY,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature with SHA512", () => {
      expect(
        _createRsaSignature({
          algorithm: "sha512",
          kryptos: TEST_RSA_KEY,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });
  });

  describe("formats", () => {
    test("should create signature at base64 digest", () => {
      expect(
        _createRsaSignature({
          kryptos: TEST_RSA_KEY,
          data,
          format: "base64",
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature at base64url digest", () => {
      expect(
        _createRsaSignature({
          kryptos: TEST_RSA_KEY,
          data,
          format: "base64url",
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature at hex digest", () => {
      expect(
        _createRsaSignature({
          kryptos: TEST_RSA_KEY,
          data,
          format: "hex",
        }),
      ).toStrictEqual(expect.any(String));
    });
  });

  describe("verify", () => {
    test("should verify signature", () => {
      const signature = _createRsaSignature({
        kryptos: TEST_RSA_KEY,
        data,
      });

      expect(
        _verifyRsaSignature({
          data,
          kryptos: TEST_RSA_KEY,
          signature,
        }),
      ).toBe(true);
    });
  });

  describe("assert", () => {
    test("should assert signature", () => {
      const signature = _createRsaSignature({
        kryptos: TEST_RSA_KEY,
        data,
      });

      expect(() =>
        _assertRsaSignature({
          data,
          kryptos: TEST_RSA_KEY,
          signature,
        }),
      ).not.toThrow();
    });

    test("should throw error on invalid signature", () => {
      const signature = _createRsaSignature({
        kryptos: TEST_RSA_KEY,
        data,
      });

      expect(() =>
        _assertRsaSignature({
          data: "invalid",
          kryptos: TEST_RSA_KEY,
          signature,
        }),
      ).toThrow(RsaError);
    });
  });
});
