import { IKryptosRsa, KryptosKit } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { TEST_RSA_KEY } from "../../__fixtures__/keys";
import { RsaError } from "../../errors";
import {
  assertRsaSignature,
  createRsaSignature,
  verifyRsaSignature,
} from "./rsa-signature";

describe("rsa-signature", () => {
  const format = "base64";

  let data: string;

  beforeEach(() => {
    data = randomBytes(32).toString("hex");
  });

  describe("algorithms", () => {
    test("should create signature with RS256", () => {
      const kryptos = KryptosKit.make.sig.rsa({ algorithm: "RS256" }) as IKryptosRsa;

      expect(createRsaSignature({ kryptos, data, format })).toEqual(expect.any(String));
    });

    test("should create signature with RS384", () => {
      const kryptos = KryptosKit.make.sig.rsa({ algorithm: "RS384" }) as IKryptosRsa;

      expect(createRsaSignature({ kryptos, data, format })).toEqual(expect.any(String));
    });

    test("should create signature with RS512", () => {
      const kryptos = KryptosKit.make.sig.rsa({ algorithm: "RS512" }) as IKryptosRsa;

      expect(createRsaSignature({ kryptos, data, format })).toEqual(expect.any(String));
    });

    test("should create signature with PS256", () => {
      const kryptos = KryptosKit.make.sig.rsa({ algorithm: "PS256" }) as IKryptosRsa;

      expect(createRsaSignature({ kryptos, data, format })).toEqual(expect.any(String));
    });

    test("should create signature with PS384", () => {
      const kryptos = KryptosKit.make.sig.rsa({ algorithm: "PS384" }) as IKryptosRsa;

      expect(createRsaSignature({ kryptos, data, format })).toEqual(expect.any(String));
    });

    test("should create signature with PS512", () => {
      const kryptos = KryptosKit.make.sig.rsa({ algorithm: "PS512" }) as IKryptosRsa;

      expect(createRsaSignature({ kryptos, data, format })).toEqual(expect.any(String));
    });
  });

  describe("formats", () => {
    const kryptos = TEST_RSA_KEY;

    test("should create signature at base64 digest", () => {
      expect(
        createRsaSignature({
          kryptos,
          data,
          format: "base64",
        }),
      ).toEqual(expect.any(String));
    });

    test("should create signature at base64url digest", () => {
      expect(
        createRsaSignature({
          kryptos,
          data,
          format: "base64url",
        }),
      ).toEqual(expect.any(String));
    });

    test("should create signature at hex digest", () => {
      expect(
        createRsaSignature({
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
      const signature = createRsaSignature({ kryptos, data, format });

      expect(
        verifyRsaSignature({
          data,
          format,
          kryptos,
          signature,
        }),
      ).toEqual(true);
    });
  });

  describe("assert", () => {
    const kryptos = TEST_RSA_KEY;

    test("should assert signature", () => {
      const signature = createRsaSignature({ kryptos, data, format });

      expect(() =>
        assertRsaSignature({
          data,
          format,
          kryptos,
          signature,
        }),
      ).not.toThrow();
    });

    test("should throw error on invalid signature", () => {
      const signature = createRsaSignature({ kryptos, data, format });

      expect(() =>
        assertRsaSignature({
          data: "invalid",
          format,
          kryptos,
          signature,
        }),
      ).toThrow(RsaError);
    });
  });
});
