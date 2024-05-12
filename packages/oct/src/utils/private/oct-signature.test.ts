import { TEST_OCT_KEY } from "../../__fixtures__/keys";
import { OctError } from "../../errors";
import { _assertOctSignature, _createOctSignature, _verifyOctSignature } from "./oct-signature";

describe("signature", () => {
  describe("SHA256", () => {
    test("should create signature at base64 digest", () => {
      expect(
        _createOctSignature({
          algorithm: "SHA256",
          data: "data",
          format: "base64",
          kryptos: TEST_OCT_KEY,
        }),
      ).toEqual("P2dk5F9sJih7de13qRZh/ylmjQquY9C2vPAKNdgLmeM=");
    });

    test("should create signature at base64url digest", () => {
      expect(
        _createOctSignature({
          algorithm: "SHA256",
          data: "data",
          format: "base64url",
          kryptos: TEST_OCT_KEY,
        }),
      ).toEqual("P2dk5F9sJih7de13qRZh_ylmjQquY9C2vPAKNdgLmeM");
    });

    test("should create signature at hex digest", () => {
      expect(
        _createOctSignature({
          algorithm: "SHA256",
          data: "data",
          format: "hex",
          kryptos: TEST_OCT_KEY,
        }),
      ).toEqual("3f6764e45f6c26287b75ed77a91661ff29668d0aae63d0b6bcf00a35d80b99e3");
    });
  });

  describe("SHA384", () => {
    test("should create signature at base64 digest", () => {
      expect(
        _createOctSignature({
          algorithm: "SHA384",
          data: "data",
          format: "base64",
          kryptos: TEST_OCT_KEY,
        }),
      ).toEqual("Z9hpdhrSWCyo3Bzsh9YQLDzZEYLPKiKnNWm+hOklkjrEJrqM9XkIpsjcbzKHiXCH");
    });

    test("should create signature at base64url digest", () => {
      expect(
        _createOctSignature({
          algorithm: "SHA384",
          data: "data",
          format: "base64url",
          kryptos: TEST_OCT_KEY,
        }),
      ).toEqual("Z9hpdhrSWCyo3Bzsh9YQLDzZEYLPKiKnNWm-hOklkjrEJrqM9XkIpsjcbzKHiXCH");
    });

    test("should create signature at hex digest", () => {
      expect(
        _createOctSignature({
          algorithm: "SHA384",
          data: "data",
          format: "hex",
          kryptos: TEST_OCT_KEY,
        }),
      ).toEqual(
        "67d869761ad2582ca8dc1cec87d6102c3cd91182cf2a22a73569be84e925923ac426ba8cf57908a6c8dc6f3287897087",
      );
    });
  });

  describe("SHA512", () => {
    test("should create signature at base64 digest", () => {
      expect(
        _createOctSignature({
          algorithm: "SHA512",
          data: "data",
          format: "base64",
          kryptos: TEST_OCT_KEY,
        }),
      ).toEqual(
        "c4BWKXzIgKmZ8rk7BMquZ43huyrDHW/ynPt3DHoKmYzq9CJc2Qyv6mUjr26X5lalW2xi/LmyL3hhOFeeylvcXw==",
      );
    });

    test("should create signature at base64url digest", () => {
      expect(
        _createOctSignature({
          algorithm: "SHA512",
          data: "data",
          format: "base64url",
          kryptos: TEST_OCT_KEY,
        }),
      ).toEqual(
        "c4BWKXzIgKmZ8rk7BMquZ43huyrDHW_ynPt3DHoKmYzq9CJc2Qyv6mUjr26X5lalW2xi_LmyL3hhOFeeylvcXw",
      );
    });

    test("should create signature at hex digest", () => {
      expect(
        _createOctSignature({
          algorithm: "SHA512",
          data: "data",
          format: "hex",
          kryptos: TEST_OCT_KEY,
        }),
      ).toEqual(
        "738056297cc880a999f2b93b04caae678de1bb2ac31d6ff29cfb770c7a0a998ceaf4225cd90cafea6523af6e97e656a55b6c62fcb9b22f786138579eca5bdc5f",
      );
    });
  });

  describe("verify", () => {
    test("should verify signature", () => {
      expect(
        _verifyOctSignature({
          data: "data",
          kryptos: TEST_OCT_KEY,
          signature: "P2dk5F9sJih7de13qRZh/ylmjQquY9C2vPAKNdgLmeM=",
        }),
      ).toEqual(true);
    });
  });

  describe("assert", () => {
    test("should assert signature", () => {
      expect(() =>
        _assertOctSignature({
          data: "data",
          kryptos: TEST_OCT_KEY,
          signature: "P2dk5F9sJih7de13qRZh/ylmjQquY9C2vPAKNdgLmeM=",
        }),
      ).not.toThrow();
    });

    test("should throw error on invalid signature", () => {
      expect(() =>
        _assertOctSignature({
          data: "invalid",
          kryptos: TEST_OCT_KEY,
          signature: "P2dk5F9sJih7de13qRZh/ylmjQquY9C2vPAKNdgLmeM=",
        }),
      ).toThrow(OctError);
    });
  });
});
