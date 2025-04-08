import {
  TEST_EC_KEY_256,
  TEST_EC_KEY_384,
  TEST_EC_KEY_512,
} from "../../__fixtures__/keys";
import { EcError } from "../../errors";
import { assertEcSignature, createEcSignature, verifyEcSignature } from "./ec-signature";

describe("ec-signature", () => {
  const dsa = "der";
  const format = "base64";

  describe("standard formatting", () => {
    const kryptos = TEST_EC_KEY_256;

    test("should sign and verify with base64 formatting", () => {
      const signature = createEcSignature({
        kryptos,
        data: "data",
        dsa,
        format: "base64",
      });

      expect(
        verifyEcSignature({ kryptos, data: "data", dsa, signature, format: "base64" }),
      ).toEqual(true);
    });

    test("should sign and verify with base64url formatting", () => {
      const signature = createEcSignature({
        kryptos,
        data: "data",
        dsa,
        format: "base64url",
      });

      expect(
        verifyEcSignature({ kryptos, data: "data", dsa, signature, format: "base64url" }),
      ).toEqual(true);
    });

    test("should sign and verify with hex formatting", () => {
      const signature = createEcSignature({ kryptos, data: "data", dsa, format: "hex" });

      expect(
        verifyEcSignature({ kryptos, data: "data", dsa, signature, format: "hex" }),
      ).toEqual(true);
    });
  });

  describe("curves", () => {
    test("should sign and verify with ES256", async () => {
      const kryptos = TEST_EC_KEY_256;

      const signature = createEcSignature({ kryptos, data: "data", dsa, format });

      expect(
        verifyEcSignature({ kryptos, data: "data", dsa, format, signature }),
      ).toEqual(true);
    });

    test("should sign and verify with ES384", async () => {
      const kryptos = TEST_EC_KEY_384;

      const signature = createEcSignature({ kryptos, data: "data", dsa, format });

      expect(
        verifyEcSignature({ kryptos, data: "data", dsa, format, signature }),
      ).toEqual(true);
    });

    test("should sign and verify with ES512", async () => {
      const kryptos = TEST_EC_KEY_512;

      const signature = createEcSignature({ kryptos, data: "data", dsa, format });

      expect(
        verifyEcSignature({ kryptos, data: "data", dsa, format, signature }),
      ).toEqual(true);
    });
  });

  describe("dsa encoding", () => {
    const kryptos = TEST_EC_KEY_256;

    test("should sign and verify with der", () => {
      const signature = createEcSignature({ kryptos, data: "data", dsa: "der", format });

      expect(
        verifyEcSignature({ kryptos, data: "data", dsa: "der", signature, format }),
      ).toEqual(true);
    });

    test("should sign and verify with ieee-p1363", () => {
      const signature = createEcSignature({
        kryptos,
        data: "data",
        dsa: "ieee-p1363",
        format,
      });

      expect(
        verifyEcSignature({
          kryptos,
          data: "data",
          dsa: "ieee-p1363",
          signature,
          format,
        }),
      ).toEqual(true);
    });
  });

  describe("raw", () => {
    test("should sign and verify with P-256 raw formatting", async () => {
      const kryptos = TEST_EC_KEY_256;

      const signature = createEcSignature({ kryptos, data: "data", dsa, format: "raw" });

      expect(
        verifyEcSignature({ kryptos, data: "data", dsa, signature, format: "raw" }),
      ).toEqual(true);
    });

    test("should sign and verify with P-384 raw formatting", async () => {
      const kryptos = TEST_EC_KEY_384;

      const signature = createEcSignature({ kryptos, data: "data", dsa, format: "raw" });

      expect(
        verifyEcSignature({ kryptos, data: "data", dsa, signature, format: "raw" }),
      ).toEqual(true);
    });

    test("should sign and verify with P-521 raw formatting", async () => {
      const kryptos = TEST_EC_KEY_512;

      const signature = createEcSignature({ kryptos, data: "data", dsa, format: "raw" });

      expect(
        verifyEcSignature({ kryptos, data: "data", dsa, signature, format: "raw" }),
      ).toEqual(true);
    });
  });

  describe("assert", () => {
    const kryptos = TEST_EC_KEY_256;

    test("should assert signature", () => {
      const signature = createEcSignature({ kryptos, data: "data", dsa, format });

      expect(() =>
        assertEcSignature({ kryptos, data: "data", dsa, format, signature }),
      ).not.toThrow();
    });

    test("should throw error on invalid signature", () => {
      const signature = createEcSignature({ kryptos, data: "data", dsa, format });

      expect(() =>
        assertEcSignature({ kryptos, data: "invalid", dsa, format, signature }),
      ).toThrow(EcError);
    });
  });
});
