import { TEST_OKP_KEY_25519, TEST_OKP_KEY_448 } from "../../__fixtures__/keys";
import { OkpError } from "../../errors";
import {
  assertOkpSignature,
  createOkpSignature,
  verifyOkpSignature,
} from "./okp-signature";

describe("okp-signature", () => {
  const dsa = "der";
  const format = "base64";

  describe("curves", () => {
    test("should create signature with 25519", () => {
      expect(
        createOkpSignature({
          kryptos: TEST_OKP_KEY_25519,
          data: "data",
          dsa,
          format: "base64",
        }),
      ).toEqual(expect.any(String));
    });

    test("should create signature with 448", () => {
      expect(
        createOkpSignature({
          kryptos: TEST_OKP_KEY_448,
          data: "data",
          dsa,
          format: "base64",
        }),
      ).toEqual(expect.any(String));
    });
  });

  describe("dsa", () => {
    const kryptos = TEST_OKP_KEY_25519;

    test("should sign and verify signature with der", () => {
      const signature = createOkpSignature({
        kryptos,
        data: "data",
        dsa: "der",
        format: "base64",
      });

      expect(
        verifyOkpSignature({ kryptos, data: "data", dsa: "der", format, signature }),
      ).toEqual(true);
    });

    test("should sign and verify signature with ieee-p1363", () => {
      const signature = createOkpSignature({
        kryptos,
        data: "data",
        dsa: "ieee-p1363",
        format: "base64",
      });

      expect(
        verifyOkpSignature({
          kryptos,
          data: "data",
          dsa: "ieee-p1363",
          format,
          signature,
        }),
      ).toEqual(true);
    });
  });

  describe("formats", () => {
    test("should create signature at base64 digest", () => {
      expect(
        createOkpSignature({
          kryptos: TEST_OKP_KEY_25519,
          data: "data",
          dsa,
          format: "base64",
        }),
      ).toEqual(expect.any(String));
    });

    test("should create signature at base64url digest", () => {
      expect(
        createOkpSignature({
          kryptos: TEST_OKP_KEY_25519,
          data: "data",
          dsa,
          format: "base64url",
        }),
      ).toEqual(expect.any(String));
    });

    test("should create signature at hex digest", () => {
      expect(
        createOkpSignature({
          kryptos: TEST_OKP_KEY_25519,
          data: "data",
          dsa,
          format: "hex",
        }),
      ).toEqual(expect.any(String));
    });
  });

  describe("verify", () => {
    test("should verify signature", () => {
      const signature = createOkpSignature({
        kryptos: TEST_OKP_KEY_25519,
        data: "data",
        dsa,
        format,
      });

      expect(
        verifyOkpSignature({
          kryptos: TEST_OKP_KEY_25519,
          data: "data",
          dsa,
          format,
          signature,
        }),
      ).toEqual(true);
    });
  });

  describe("assert", () => {
    test("should assert signature", () => {
      const signature = createOkpSignature({
        kryptos: TEST_OKP_KEY_25519,
        data: "data",
        dsa,
        format,
      });

      expect(() =>
        assertOkpSignature({
          kryptos: TEST_OKP_KEY_25519,
          data: "data",
          dsa,
          format,
          signature,
        }),
      ).not.toThrow();
    });

    test("should throw error on invalid signature", () => {
      const signature = createOkpSignature({
        kryptos: TEST_OKP_KEY_25519,
        data: "data",
        dsa,
        format,
      });

      expect(() =>
        assertOkpSignature({
          kryptos: TEST_OKP_KEY_25519,
          data: "invalid",
          dsa,
          format,
          signature,
        }),
      ).toThrow(OkpError);
    });
  });
});
