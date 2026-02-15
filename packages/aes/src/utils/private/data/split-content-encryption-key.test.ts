import { KryptosEncryption } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import { splitContentEncryptionKey } from "./split-content-encryption-key";

describe("splitContentEncryptionKey", () => {
  describe("CBC modes (RFC 7518 order: hashKey first, encryptionKey last)", () => {
    test("A128CBC-HS256 with 32-byte CEK: hashKey = first 16 bytes, encryptionKey = last 16 bytes", () => {
      // Create deterministic buffer: [0, 1, 2, ..., 31]
      const cek = Buffer.from(Array.from({ length: 32 }, (_, i) => i));

      const result = splitContentEncryptionKey("A128CBC-HS256", cek);

      expect(result.hashKey.length).toBe(16);
      expect(result.encryptionKey.length).toBe(16);

      // hashKey = first 16 bytes [0..15]
      expect(result.hashKey).toEqual(
        Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
      );

      // encryptionKey = last 16 bytes [16..31]
      expect(result.encryptionKey).toEqual(
        Buffer.from([16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]),
      );
    });

    test("A192CBC-HS384 with 48-byte CEK: hashKey = first 24 bytes, encryptionKey = last 24 bytes", () => {
      // Create deterministic buffer: [0, 1, 2, ..., 47]
      const cek = Buffer.from(Array.from({ length: 48 }, (_, i) => i));

      const result = splitContentEncryptionKey("A192CBC-HS384", cek);

      expect(result.hashKey.length).toBe(24);
      expect(result.encryptionKey.length).toBe(24);

      // hashKey = first 24 bytes [0..23]
      expect(result.hashKey).toEqual(
        Buffer.from([
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
          22, 23,
        ]),
      );

      // encryptionKey = last 24 bytes [24..47]
      expect(result.encryptionKey).toEqual(
        Buffer.from([
          24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43,
          44, 45, 46, 47,
        ]),
      );
    });

    test("A256CBC-HS512 with 64-byte CEK: hashKey = first 32 bytes, encryptionKey = last 32 bytes", () => {
      // Create deterministic buffer: [0, 1, 2, ..., 63]
      const cek = Buffer.from(Array.from({ length: 64 }, (_, i) => i));

      const result = splitContentEncryptionKey("A256CBC-HS512", cek);

      expect(result.hashKey.length).toBe(32);
      expect(result.encryptionKey.length).toBe(32);

      // hashKey = first 32 bytes [0..31]
      expect(result.hashKey).toEqual(
        Buffer.from([
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
          22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
        ]),
      );

      // encryptionKey = last 32 bytes [32..63]
      expect(result.encryptionKey).toEqual(
        Buffer.from([
          32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
          52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63,
        ]),
      );
    });
  });

  describe("GCM modes", () => {
    test("A128GCM with 16-byte CEK: encryptionKey = full 16 bytes, hashKey = empty buffer", () => {
      // Create deterministic buffer: [0, 1, 2, ..., 15]
      const cek = Buffer.from(Array.from({ length: 16 }, (_, i) => i));

      const result = splitContentEncryptionKey("A128GCM", cek);

      expect(result.encryptionKey.length).toBe(16);
      expect(result.hashKey.length).toBe(0);

      expect(result.encryptionKey).toEqual(
        Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
      );
      expect(result.hashKey).toEqual(Buffer.alloc(0));
    });

    test("A192GCM with 24-byte CEK: encryptionKey = full 24 bytes, hashKey = empty buffer", () => {
      // Create deterministic buffer: [0, 1, 2, ..., 23]
      const cek = Buffer.from(Array.from({ length: 24 }, (_, i) => i));

      const result = splitContentEncryptionKey("A192GCM", cek);

      expect(result.encryptionKey.length).toBe(24);
      expect(result.hashKey.length).toBe(0);

      expect(result.encryptionKey).toEqual(
        Buffer.from([
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
          22, 23,
        ]),
      );
      expect(result.hashKey).toEqual(Buffer.alloc(0));
    });

    test("A256GCM with 32-byte CEK: encryptionKey = full 32 bytes, hashKey = empty buffer", () => {
      // Create deterministic buffer: [0, 1, 2, ..., 31]
      const cek = Buffer.from(Array.from({ length: 32 }, (_, i) => i));

      const result = splitContentEncryptionKey("A256GCM", cek);

      expect(result.encryptionKey.length).toBe(32);
      expect(result.hashKey.length).toBe(0);

      expect(result.encryptionKey).toEqual(
        Buffer.from([
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
          22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
        ]),
      );
      expect(result.hashKey).toEqual(Buffer.alloc(0));
    });
  });

  describe("Error cases", () => {
    test("should throw AesError when GCM CEK is too large (hash key not empty)", () => {
      // A128GCM expects 16-byte CEK, provide 32 bytes
      const cek = Buffer.from(Array.from({ length: 32 }, (_, i) => i));

      expect(() => splitContentEncryptionKey("A128GCM", cek)).toThrow(AesError);
      expect(() => splitContentEncryptionKey("A128GCM", cek)).toThrow(
        "Unexpected hash key",
      );
    });

    test("should throw AesError when A192GCM CEK is too large", () => {
      // A192GCM expects 24-byte CEK, provide 48 bytes
      const cek = Buffer.from(Array.from({ length: 48 }, (_, i) => i));

      expect(() => splitContentEncryptionKey("A192GCM", cek)).toThrow(AesError);
      expect(() => splitContentEncryptionKey("A192GCM", cek)).toThrow(
        "Unexpected hash key",
      );
    });

    test("should throw AesError when A256GCM CEK is too large", () => {
      // A256GCM expects 32-byte CEK, provide 64 bytes
      const cek = Buffer.from(Array.from({ length: 64 }, (_, i) => i));

      expect(() => splitContentEncryptionKey("A256GCM", cek)).toThrow(AesError);
      expect(() => splitContentEncryptionKey("A256GCM", cek)).toThrow(
        "Unexpected hash key",
      );
    });

    test("should throw AesError for unsupported encryption algorithm", () => {
      const cek = Buffer.from(Array.from({ length: 32 }, (_, i) => i));

      expect(() =>
        splitContentEncryptionKey("UNSUPPORTED" as KryptosEncryption, cek),
      ).toThrow(AesError);

      expect(() =>
        splitContentEncryptionKey("UNSUPPORTED" as KryptosEncryption, cek),
      ).toThrow("Unexpected algorithm");
    });
  });
});
