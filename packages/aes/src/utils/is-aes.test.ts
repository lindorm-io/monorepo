import { isAesBufferData, isAesSerialisedData, isAesTokenised } from "./is-aes.js";
import type { AesDecryptionRecord, SerialisedAesDecryption } from "../types/index.js";
import { createTestAesDecryptionRecord } from "./__fixtures__/aes-decryption-record.js";
import { describe, expect, test } from "vitest";

describe("is-aes", () => {
  describe("isAesBufferData", () => {
    test("should return true when any value is a Buffer", () => {
      const data: AesDecryptionRecord = createTestAesDecryptionRecord();

      expect(isAesBufferData(data)).toBe(true);
    });

    test("should return true when multiple values are Buffers", () => {
      const data: AesDecryptionRecord = createTestAesDecryptionRecord({
        authTag: Buffer.from("tag"),
      });

      expect(isAesBufferData(data)).toBe(true);
    });

    test("should return false when no values are Buffers", () => {
      const data: SerialisedAesDecryption = {
        ciphertext: "dGVzdA",
        header: "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIiwidiI6IjEuMCJ9",
        iv: "aXY",
        tag: "dGFn",
        v: "1.0",
      };

      expect(isAesBufferData(data)).toBe(false);
    });

    test("should return false when all values are strings", () => {
      const data: SerialisedAesDecryption = {
        cek: "Y2Vr",
        ciphertext: "dGVzdA",
        header: "eyJhbGciOiJkaXIifQ",
        iv: "aXY",
        tag: "dGFn",
        v: "1.0",
      };

      expect(isAesBufferData(data)).toBe(false);
    });

    test("should return false when values are undefined or other types", () => {
      const data: SerialisedAesDecryption = {
        cek: undefined,
        ciphertext: "dGVzdA",
        header: "eyJhbGciOiJkaXIifQ",
        iv: "aXY",
        tag: "dGFn",
        v: "1.0",
      };

      expect(isAesBufferData(data)).toBe(false);
    });
  });

  describe("isAesSerialisedData", () => {
    test("should return true when no values are Buffers", () => {
      const data: SerialisedAesDecryption = {
        ciphertext: "dGVzdA",
        header: "eyJhbGciOiJkaXIifQ",
        iv: "aXY",
        tag: "dGFn",
        v: "1.0",
      };

      expect(isAesSerialisedData(data)).toBe(true);
    });

    test("should return true when all values are strings or undefined", () => {
      const data: SerialisedAesDecryption = {
        cek: "Y2Vr",
        ciphertext: "dGVzdA",
        header: "eyJhbGciOiJkaXIifQ",
        iv: "aXY",
        tag: "dGFn",
        v: "1.0",
      };

      expect(isAesSerialisedData(data)).toBe(true);
    });

    test("should return false when any value is a Buffer", () => {
      const data: AesDecryptionRecord = createTestAesDecryptionRecord();

      expect(isAesSerialisedData(data)).toBe(false);
    });

    test("should return false when at least one value is a Buffer", () => {
      const data = {
        ciphertext: "dGVzdA",
        header: "eyJhbGciOiJkaXIifQ",
        iv: Buffer.from("iv"),
        tag: "dGFn",
        v: "1.0",
      };

      expect(isAesSerialisedData(data as any)).toBe(false);
    });
  });

  describe("isAesTokenised", () => {
    test("should return true for string starting with 'aes:'", () => {
      expect(isAesTokenised("aes:header$iv$tag$ciphertext")).toBe(true);
    });

    test("should return true for any string starting with 'aes:'", () => {
      expect(isAesTokenised("aes:something")).toBe(true);
    });

    test("should return false when string does not start with 'aes:'", () => {
      expect(isAesTokenised("$v=1$alg=A256GCM$data$")).toBe(false);
    });

    test("should return false for empty string", () => {
      expect(isAesTokenised("")).toBe(false);
    });

    test("should return false for non-string input", () => {
      expect(isAesTokenised(null as any)).toBe(false);
      expect(isAesTokenised(undefined as any)).toBe(false);
      expect(isAesTokenised(123 as any)).toBe(false);
      expect(isAesTokenised({} as any)).toBe(false);
    });

    test("should return false for base64url-encoded string (no aes: prefix)", () => {
      expect(isAesTokenised("eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0")).toBe(false);
    });
  });
});
