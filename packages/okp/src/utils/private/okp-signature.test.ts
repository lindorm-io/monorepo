import { TEST_OKP_KEY_25519, TEST_OKP_KEY_448 } from "../../__fixtures__/keys";
import { OkpError } from "../../errors";
import {
  _assertOkpSignature,
  _createOkpSignature,
  _verifyOkpSignature,
} from "./okp-signature";

describe("okp-signature", () => {
  const format = "base64";

  describe("algorithms", () => {
    test("should create signature with 25519", () => {
      expect(
        _createOkpSignature({
          kryptos: TEST_OKP_KEY_25519,
          data: "data",
          format: "base64",
        }),
      ).toEqual(expect.any(String));
    });

    test("should create signature with 448", () => {
      expect(
        _createOkpSignature({
          kryptos: TEST_OKP_KEY_448,
          data: "data",
          format: "base64",
        }),
      ).toEqual(expect.any(String));
    });
  });

  describe("formats", () => {
    test("should create signature at base64 digest", () => {
      expect(
        _createOkpSignature({
          kryptos: TEST_OKP_KEY_25519,
          data: "data",
          format: "base64",
        }),
      ).toEqual(expect.any(String));
    });

    test("should create signature at base64url digest", () => {
      expect(
        _createOkpSignature({
          kryptos: TEST_OKP_KEY_25519,
          data: "data",
          format: "base64url",
        }),
      ).toEqual(expect.any(String));
    });

    test("should create signature at hex digest", () => {
      expect(
        _createOkpSignature({
          kryptos: TEST_OKP_KEY_25519,
          data: "data",
          format: "hex",
        }),
      ).toEqual(expect.any(String));
    });
  });

  describe("verify", () => {
    test("should verify signature", () => {
      const signature = _createOkpSignature({
        kryptos: TEST_OKP_KEY_25519,
        data: "data",
        format,
      });

      expect(
        _verifyOkpSignature({
          kryptos: TEST_OKP_KEY_25519,
          data: "data",
          format,
          signature,
        }),
      ).toBe(true);
    });
  });

  describe("assert", () => {
    test("should assert signature", () => {
      const signature = _createOkpSignature({
        kryptos: TEST_OKP_KEY_25519,
        data: "data",
        format,
      });

      expect(() =>
        _assertOkpSignature({
          kryptos: TEST_OKP_KEY_25519,
          data: "data",
          format,
          signature,
        }),
      ).not.toThrow();
    });

    test("should throw error on invalid signature", () => {
      const signature = _createOkpSignature({
        kryptos: TEST_OKP_KEY_25519,
        data: "data",
        format,
      });

      expect(() =>
        _assertOkpSignature({
          kryptos: TEST_OKP_KEY_25519,
          data: "invalid",
          format,
          signature,
        }),
      ).toThrow(OkpError);
    });
  });
});
