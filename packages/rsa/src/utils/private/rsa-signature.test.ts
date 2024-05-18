import { Kryptos } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { TEST_RSA_KEY } from "../../__fixtures__/keys";
import { RsaError } from "../../errors";
import {
  _assertRsaSignature,
  _createRsaSignature,
  _verifyRsaSignature,
} from "./rsa-signature";

describe("rsa-signature", () => {
  const format = "base64";

  let data: string;

  beforeEach(() => {
    data = randomBytes(32).toString("hex");
  });

  describe("algorithms", () => {
    test("should create signature with RS256", () => {
      const kryptos = Kryptos.generate({
        algorithm: "RS256",
        type: "RSA",
        use: "sig",
      });

      expect(_createRsaSignature({ kryptos, data, format })).toEqual(expect.any(String));
    });

    test("should create signature with RS384", () => {
      const kryptos = Kryptos.generate({
        algorithm: "RS384",
        type: "RSA",
        use: "sig",
      });

      expect(_createRsaSignature({ kryptos, data, format })).toEqual(expect.any(String));
    });

    test("should create signature with RS512", () => {
      const kryptos = Kryptos.generate({
        algorithm: "RS512",
        type: "RSA",
        use: "sig",
      });

      expect(_createRsaSignature({ kryptos, data, format })).toEqual(expect.any(String));
    });

    test("should create signature with PS256", () => {
      const kryptos = Kryptos.generate({
        algorithm: "PS256",
        type: "RSA",
        use: "sig",
      });

      expect(_createRsaSignature({ kryptos, data, format })).toEqual(expect.any(String));
    });

    test("should create signature with PS384", () => {
      const kryptos = Kryptos.generate({
        algorithm: "PS384",
        type: "RSA",
        use: "sig",
      });

      expect(_createRsaSignature({ kryptos, data, format })).toEqual(expect.any(String));
    });

    test("should create signature with PS512", () => {
      const kryptos = Kryptos.generate({
        algorithm: "PS512",
        type: "RSA",
        use: "sig",
      });

      expect(_createRsaSignature({ kryptos, data, format })).toEqual(expect.any(String));
    });
  });

  describe("formats", () => {
    const kryptos = TEST_RSA_KEY;

    test("should create signature at base64 digest", () => {
      expect(
        _createRsaSignature({
          kryptos,
          data,
          format: "base64",
        }),
      ).toEqual(expect.any(String));
    });

    test("should create signature at base64url digest", () => {
      expect(
        _createRsaSignature({
          kryptos,
          data,
          format: "base64url",
        }),
      ).toEqual(expect.any(String));
    });

    test("should create signature at hex digest", () => {
      expect(
        _createRsaSignature({
          kryptos,
          data,
          format: "hex",
        }),
      ).toEqual(expect.any(String));
    });
  });

  describe("verify", () => {
    const kryptos = TEST_RSA_KEY;

    test("should verify signature", () => {
      const signature = _createRsaSignature({ kryptos, data, format });

      expect(
        _verifyRsaSignature({
          data,
          format,
          kryptos,
          signature,
        }),
      ).toBe(true);
    });
  });

  describe("assert", () => {
    const kryptos = TEST_RSA_KEY;

    test("should assert signature", () => {
      const signature = _createRsaSignature({ kryptos, data, format });

      expect(() =>
        _assertRsaSignature({
          data,
          format,
          kryptos,
          signature,
        }),
      ).not.toThrow();
    });

    test("should throw error on invalid signature", () => {
      const signature = _createRsaSignature({ kryptos, data, format });

      expect(() =>
        _assertRsaSignature({
          data: "invalid",
          format,
          kryptos,
          signature,
        }),
      ).toThrow(RsaError);
    });
  });
});
