import { TEST_OKP_KEY } from "../../__fixtures__/keys";
import { OkpError } from "../../errors";
import { _assertOkpSignature, _createOkpSignature, _verifyOkpSignature } from "./okp-signature";

describe("okp-signature", () => {
  const format = "base64";

  describe("formats", () => {
    test("should create signature at base64 digest", () => {
      expect(
        _createOkpSignature({
          kryptos: TEST_OKP_KEY,
          data: "data",
          format: "base64",
        }),
      ).toEqual(expect.any(String));
    });

    test("should create signature at base64url digest", () => {
      expect(
        _createOkpSignature({
          kryptos: TEST_OKP_KEY,
          data: "data",
          format: "base64url",
        }),
      ).toEqual(expect.any(String));
    });

    test("should create signature at hex digest", () => {
      expect(
        _createOkpSignature({
          kryptos: TEST_OKP_KEY,
          data: "data",
          format: "hex",
        }),
      ).toEqual(expect.any(String));
    });
  });

  describe("verify", () => {
    test("should verify signature", () => {
      const signature = _createOkpSignature({ kryptos: TEST_OKP_KEY, data: "data", format });

      expect(_verifyOkpSignature({ kryptos: TEST_OKP_KEY, data: "data", format, signature })).toBe(
        true,
      );
    });
  });

  describe("assert", () => {
    test("should assert signature", () => {
      const signature = _createOkpSignature({ kryptos: TEST_OKP_KEY, data: "data", format });

      expect(() =>
        _assertOkpSignature({ kryptos: TEST_OKP_KEY, data: "data", format, signature }),
      ).not.toThrow();
    });

    test("should throw error on invalid signature", () => {
      const signature = _createOkpSignature({ kryptos: TEST_OKP_KEY, data: "data", format });

      expect(() =>
        _assertOkpSignature({ kryptos: TEST_OKP_KEY, data: "invalid", format, signature }),
      ).toThrow(OkpError);
    });
  });
});
