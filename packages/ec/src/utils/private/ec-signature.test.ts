import { TEST_EC_KEY_256, TEST_EC_KEY_384, TEST_EC_KEY_512 } from "../../__fixtures__/keys";
import { EcError } from "../../errors";
import { _assertEcSignature, _createEcSignature, _verifyEcSignature } from "./ec-signature";

describe("ec-signature", () => {
  const format = "base64";

  describe("standard formatting", () => {
    const kryptos = TEST_EC_KEY_256;

    test("should sign and verify with base64 formatting", () => {
      const signature = _createEcSignature({ kryptos, data: "data", format: "base64" });

      expect(_verifyEcSignature({ kryptos, data: "data", signature, format: "base64" })).toBe(true);
    });

    test("should sign and verify with base64url formatting", () => {
      const signature = _createEcSignature({ kryptos, data: "data", format: "base64url" });

      expect(_verifyEcSignature({ kryptos, data: "data", signature, format: "base64url" })).toBe(
        true,
      );
    });

    test("should sign and verify with hex formatting", () => {
      const signature = _createEcSignature({ kryptos, data: "data", format: "hex" });

      expect(_verifyEcSignature({ kryptos, data: "data", signature, format: "hex" })).toBe(true);
    });
  });

  describe("curves", () => {
    test("should sign and verify with ES256", async () => {
      const kryptos = TEST_EC_KEY_256;

      const signature = _createEcSignature({ kryptos, data: "data", format });

      expect(_verifyEcSignature({ kryptos, data: "data", format, signature })).toBe(true);
    });

    test("should sign and verify with ES384", async () => {
      const kryptos = TEST_EC_KEY_384;

      const signature = _createEcSignature({ kryptos, data: "data", format });

      expect(_verifyEcSignature({ kryptos, data: "data", format, signature })).toBe(true);
    });

    test("should sign and verify with ES512", async () => {
      const kryptos = TEST_EC_KEY_512;

      const signature = _createEcSignature({ kryptos, data: "data", format });

      expect(_verifyEcSignature({ kryptos, data: "data", format, signature })).toBe(true);
    });
  });

  describe("raw", () => {
    test("should sign and verify with P-256 raw formatting", async () => {
      const kryptos = TEST_EC_KEY_256;

      const signature = _createEcSignature({ kryptos, data: "data", format: "raw" });

      expect(_verifyEcSignature({ kryptos, data: "data", signature, format: "raw" })).toBe(true);
    });

    test("should sign and verify with P-384 raw formatting", async () => {
      const kryptos = TEST_EC_KEY_384;

      const signature = _createEcSignature({ kryptos, data: "data", format: "raw" });

      expect(_verifyEcSignature({ kryptos, data: "data", signature, format: "raw" })).toBe(true);
    });

    test("should sign and verify with P-521 raw formatting", async () => {
      const kryptos = TEST_EC_KEY_512;

      const signature = _createEcSignature({ kryptos, data: "data", format: "raw" });

      expect(_verifyEcSignature({ kryptos, data: "data", signature, format: "raw" })).toBe(true);
    });
  });

  describe("assert", () => {
    const kryptos = TEST_EC_KEY_256;

    test("should assert signature", () => {
      const signature = _createEcSignature({ kryptos, data: "data", format });

      expect(() => _assertEcSignature({ kryptos, data: "data", format, signature })).not.toThrow();
    });

    test("should throw error on invalid signature", () => {
      const signature = _createEcSignature({ kryptos, data: "data", format });

      expect(() => _assertEcSignature({ kryptos, data: "invalid", format, signature })).toThrow(
        EcError,
      );
    });
  });
});
