import { TEST_EC_KEY } from "../../__fixtures__/keys";
import { EcError } from "../../errors";
import { _assertEcSignature, _createEcSignature, _verifyEcSignature } from "./ec-signature";

describe("ec-signature", () => {
  describe("SHA256", () => {
    test("should create signature at base64 digest", () => {
      expect(
        _createEcSignature({
          kryptos: TEST_EC_KEY,
          data: "data",
          algorithm: "SHA256",
          format: "base64",
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature at hex digest", () => {
      expect(
        _createEcSignature({
          kryptos: TEST_EC_KEY,
          data: "data",
          algorithm: "SHA256",
          format: "hex",
        }),
      ).toStrictEqual(expect.any(String));
    });
  });

  describe("SHA384", () => {
    test("should create signature at base64 digest", () => {
      expect(
        _createEcSignature({
          kryptos: TEST_EC_KEY,
          data: "data",
          algorithm: "SHA384",
          format: "base64",
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature at hex digest", () => {
      expect(
        _createEcSignature({
          kryptos: TEST_EC_KEY,
          data: "data",
          algorithm: "SHA384",
          format: "hex",
        }),
      ).toStrictEqual(expect.any(String));
    });
  });

  describe("SHA512", () => {
    test("should create signature at base64 digest", () => {
      expect(
        _createEcSignature({
          kryptos: TEST_EC_KEY,
          data: "data",
          algorithm: "SHA512",
          format: "base64",
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature at hex digest", () => {
      expect(
        _createEcSignature({
          kryptos: TEST_EC_KEY,
          data: "data",
          algorithm: "SHA512",
          format: "hex",
        }),
      ).toStrictEqual(expect.any(String));
    });
  });

  describe("verify", () => {
    test("should verify signature", () => {
      const signature = _createEcSignature({ kryptos: TEST_EC_KEY, data: "data" });

      expect(_verifyEcSignature({ kryptos: TEST_EC_KEY, data: "data", signature })).toBe(true);
    });
  });

  describe("assert", () => {
    test("should assert signature", () => {
      const signature = _createEcSignature({ kryptos: TEST_EC_KEY, data: "data" });

      expect(() =>
        _assertEcSignature({ kryptos: TEST_EC_KEY, data: "data", signature }),
      ).not.toThrow();
    });

    test("should throw error on invalid signature", () => {
      const signature = _createEcSignature({ kryptos: TEST_EC_KEY, data: "data" });

      expect(() =>
        _assertEcSignature({ kryptos: TEST_EC_KEY, data: "invalid", signature }),
      ).toThrow(EcError);
    });
  });
});
