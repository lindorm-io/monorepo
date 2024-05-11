import { randomBytes } from "crypto";
import { RSA_KEYS } from "../../__fixtures__/rsa-keys.fixture";
import { RsaError } from "../../errors";
import { _assertRsaHash, _createRsaHash, _verifyRsaHash } from "./rsa-hash";

describe("rsa-hash", () => {
  let data: string;

  beforeEach(() => {
    data = randomBytes(32).toString("hex");
  });

  describe("algorithms", () => {
    test("should create hash with RSA_SHA256", () => {
      expect(
        _createRsaHash({
          algorithm: "RSA-SHA256",
          kryptos: RSA_KEYS,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create hash with RSA_SHA384", () => {
      expect(
        _createRsaHash({
          algorithm: "RSA-SHA384",
          kryptos: RSA_KEYS,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create hash with RSA_SHA512", () => {
      expect(
        _createRsaHash({
          algorithm: "RSA-SHA512",
          kryptos: RSA_KEYS,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create hash with SHA256", () => {
      expect(
        _createRsaHash({
          algorithm: "sha256",
          kryptos: RSA_KEYS,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create hash with SHA384", () => {
      expect(
        _createRsaHash({
          algorithm: "sha384",
          kryptos: RSA_KEYS,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create hash with SHA512", () => {
      expect(
        _createRsaHash({
          algorithm: "sha512",
          kryptos: RSA_KEYS,
          data,
        }),
      ).toStrictEqual(expect.any(String));
    });
  });

  describe("formats", () => {
    test("should create hash at base64 digest", () => {
      expect(
        _createRsaHash({
          kryptos: RSA_KEYS,
          data,
          format: "base64",
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create hash at base64url digest", () => {
      expect(
        _createRsaHash({
          kryptos: RSA_KEYS,
          data,
          format: "base64url",
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create hash at hex digest", () => {
      expect(
        _createRsaHash({
          kryptos: RSA_KEYS,
          data,
          format: "hex",
        }),
      ).toStrictEqual(expect.any(String));
    });
  });

  describe("verify", () => {
    test("should verify hash", () => {
      const hash = _createRsaHash({
        kryptos: RSA_KEYS,
        data,
      });

      expect(
        _verifyRsaHash({
          data,
          kryptos: RSA_KEYS,
          hash,
        }),
      ).toBe(true);
    });
  });

  describe("assert", () => {
    test("should assert hash", () => {
      const hash = _createRsaHash({
        kryptos: RSA_KEYS,
        data,
      });

      expect(() =>
        _assertRsaHash({
          data,
          kryptos: RSA_KEYS,
          hash,
        }),
      ).not.toThrow();
    });

    test("should throw error on invalid hash", () => {
      const hash = _createRsaHash({
        kryptos: RSA_KEYS,
        data,
      });

      expect(() =>
        _assertRsaHash({
          data: "invalid",
          kryptos: RSA_KEYS,
          hash,
        }),
      ).toThrow(RsaError);
    });
  });
});
