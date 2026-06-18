import { describe, expect, test } from "vitest";
import { KryptosError } from "../../../errors/index.js";
import type { KryptosFromString } from "../../../types/index.js";
import { createDerFromUtf } from "./der-from-utf.js";

const base = {
  id: "key_test",
  type: "oct" as const,
  use: "sig" as const,
};

describe("createDerFromUtf", () => {
  describe("enc", () => {
    test("should use an exact-size secret raw", () => {
      const privateKey = "0123456789abcdef"; // 16 bytes

      const options = {
        ...base,
        algorithm: "A128KW",
        use: "enc",
        privateKey,
      } as KryptosFromString;

      const result = createDerFromUtf(options);

      expect(result.privateKey).toEqual(Buffer.from(privateKey, "utf8"));
      expect(result.privateKey!.length).toBe(16);
    });

    test("should throw on a non-exact-size secret", () => {
      const options = {
        ...base,
        algorithm: "A128KW",
        use: "enc",
        privateKey: "tooshort",
      } as KryptosFromString;

      expect(() => createDerFromUtf(options)).toThrow(KryptosError);
    });
  });

  describe("hmac", () => {
    test("should use a secret at or above the minimum raw", () => {
      const privateKey = "0123456789abcdef"; // 16 bytes == HS256 min

      const options = {
        ...base,
        algorithm: "HS256",
        privateKey,
      } as KryptosFromString;

      const result = createDerFromUtf(options);

      expect(result.privateKey).toEqual(Buffer.from(privateKey, "utf8"));
      expect(result.privateKey!.length).toBe(16);
    });

    test("should use a longer secret raw without truncation", () => {
      const privateKey = "0123456789abcdefghijklmnop"; // 26 bytes > HS256 min

      const options = {
        ...base,
        algorithm: "HS256",
        privateKey,
      } as KryptosFromString;

      const result = createDerFromUtf(options);

      expect(result.privateKey).toEqual(Buffer.from(privateKey, "utf8"));
      expect(result.privateKey!.length).toBe(26);
    });

    test("should throw on a secret below the minimum", () => {
      const options = {
        ...base,
        algorithm: "HS256",
        privateKey: "short",
      } as KryptosFromString;

      expect(() => createDerFromUtf(options)).toThrow(KryptosError);
    });
  });

  test("should throw when no private key is provided", () => {
    const options = {
      ...base,
      algorithm: "HS256",
    } as KryptosFromString;

    expect(() => createDerFromUtf(options)).toThrow(KryptosError);
  });

  test("should throw for a non-oct key type", () => {
    const options = {
      ...base,
      type: "RSA",
      algorithm: "HS256",
      privateKey: "0123456789abcdef",
    } as unknown as KryptosFromString;

    expect(() => createDerFromUtf(options)).toThrow(KryptosError);
  });
});
