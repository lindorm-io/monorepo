import { isAesBufferData, isAesSerialisedData, isAesTokenised } from "./is-aes";
import { AesDecryptionRecord, SerialisedAesDecryption } from "../types";

describe("is-aes", () => {
  describe("isAesBufferData", () => {
    test("should return true when any value is a Buffer", () => {
      const data: AesDecryptionRecord = {
        content: Buffer.from("test"),
        encryption: "A256GCM",
        initialisationVector: Buffer.from("iv"),
      };

      expect(isAesBufferData(data)).toBe(true);
    });

    test("should return true when multiple values are Buffers", () => {
      const data: AesDecryptionRecord = {
        content: Buffer.from("test"),
        encryption: "A256GCM",
        initialisationVector: Buffer.from("iv"),
        authTag: Buffer.from("tag"),
      };

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
      const data: AesDecryptionRecord = {
        content: Buffer.from("test"),
        encryption: "A256GCM",
        initialisationVector: Buffer.from("iv"),
      };

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
