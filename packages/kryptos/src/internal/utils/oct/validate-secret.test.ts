import { describe, expect, test } from "vitest";
import { KryptosError } from "../../../errors/index.js";
import { isOctSecretConformant, validateOctSecret } from "./validate-secret.js";

describe("validateOctSecret", () => {
  describe("hmac", () => {
    test("should pass when secret meets the minimum length", () => {
      expect(() =>
        validateOctSecret({ algorithm: "HS256" }, Buffer.alloc(16)),
      ).not.toThrow();
    });

    test("should pass when secret exceeds the minimum length", () => {
      expect(() =>
        validateOctSecret({ algorithm: "HS256" }, Buffer.alloc(100)),
      ).not.toThrow();
    });

    test("should throw when secret is under the minimum length", () => {
      expect(() => validateOctSecret({ algorithm: "HS512" }, Buffer.alloc(31))).toThrow(
        KryptosError,
      );

      try {
        validateOctSecret({ algorithm: "HS512" }, Buffer.alloc(31));
      } catch (err: any) {
        expect(err.code).toBe("invalid_oct_secret_size");
        expect(err.data).toEqual({ algorithm: "HS512", expected: 32, actual: 31 });
      }
    });
  });

  describe("enc", () => {
    test("should pass when secret is exactly the required size", () => {
      expect(() =>
        validateOctSecret({ algorithm: "A256KW" }, Buffer.alloc(32)),
      ).not.toThrow();
    });

    test("should throw when secret is shorter than the required size", () => {
      try {
        validateOctSecret({ algorithm: "A256KW" }, Buffer.alloc(31));
        throw new Error("did not throw");
      } catch (err: any) {
        expect(err).toBeInstanceOf(KryptosError);
        expect(err.code).toBe("invalid_oct_secret_size");
        expect(err.data).toEqual({ algorithm: "A256KW", expected: 32, actual: 31 });
      }
    });

    test("should throw when secret is longer than the required size", () => {
      try {
        validateOctSecret({ algorithm: "dir", encryption: "A128GCM" }, Buffer.alloc(17));
        throw new Error("did not throw");
      } catch (err: any) {
        expect(err).toBeInstanceOf(KryptosError);
        expect(err.code).toBe("invalid_oct_secret_size");
        expect(err.data).toEqual({ algorithm: "dir", expected: 16, actual: 17 });
      }
    });
  });
});

describe("isOctSecretConformant", () => {
  test("hmac: true at minimum, false below", () => {
    expect(isOctSecretConformant({ algorithm: "HS384" }, Buffer.alloc(24))).toBe(true);
    expect(isOctSecretConformant({ algorithm: "HS384" }, Buffer.alloc(23))).toBe(false);
  });

  test("enc: true only at the exact size", () => {
    expect(isOctSecretConformant({ algorithm: "A192KW" }, Buffer.alloc(24))).toBe(true);
    expect(isOctSecretConformant({ algorithm: "A192KW" }, Buffer.alloc(23))).toBe(false);
    expect(isOctSecretConformant({ algorithm: "A192KW" }, Buffer.alloc(25))).toBe(false);
  });
});
