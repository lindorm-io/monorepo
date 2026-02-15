import { isAesBufferData, isAesSerialisedData, isAesTokenised } from "./is-aes";
import { AesDecryptionRecord, SerialisedAesDecryption } from "../types";

describe("is-aes", () => {
  describe("isAesBufferData", () => {
    it("should return true when any value is a Buffer", () => {
      const data: AesDecryptionRecord = {
        content: Buffer.from("test"),
        encryption: "A256GCM",
        initialisationVector: Buffer.from("iv"),
      };

      expect(isAesBufferData(data)).toBe(true);
    });

    it("should return true when multiple values are Buffers", () => {
      const data: AesDecryptionRecord = {
        content: Buffer.from("test"),
        encryption: "A256GCM",
        initialisationVector: Buffer.from("iv"),
        authTag: Buffer.from("tag"),
        hkdfSalt: Buffer.from("salt"),
      };

      expect(isAesBufferData(data)).toBe(true);
    });

    it("should return false when no values are Buffers", () => {
      const data: SerialisedAesDecryption = {
        content: "dGVzdA==",
        encryption: "A256GCM",
        initialisationVector: "aXY=",
      };

      expect(isAesBufferData(data)).toBe(false);
    });

    it("should return false when all values are strings", () => {
      const data: SerialisedAesDecryption = {
        content: "dGVzdA==",
        encryption: "A256GCM",
        initialisationVector: "aXY=",
        authTag: "dGFn",
        hkdfSalt: "c2FsdA==",
      };

      expect(isAesBufferData(data)).toBe(false);
    });

    it("should return false when values are undefined or other types", () => {
      const data: SerialisedAesDecryption = {
        content: "dGVzdA==",
        encryption: "A256GCM",
        initialisationVector: "aXY=",
        authTag: undefined,
        hkdfSalt: undefined,
      };

      expect(isAesBufferData(data)).toBe(false);
    });
  });

  describe("isAesSerialisedData", () => {
    it("should return true when no values are Buffers", () => {
      const data: SerialisedAesDecryption = {
        content: "dGVzdA==",
        encryption: "A256GCM",
        initialisationVector: "aXY=",
      };

      expect(isAesSerialisedData(data)).toBe(true);
    });

    it("should return true when all values are strings or undefined", () => {
      const data: SerialisedAesDecryption = {
        content: "dGVzdA==",
        encryption: "A256GCM",
        initialisationVector: "aXY=",
        authTag: "dGFn",
        hkdfSalt: undefined,
      };

      expect(isAesSerialisedData(data)).toBe(true);
    });

    it("should return false when any value is a Buffer", () => {
      const data: AesDecryptionRecord = {
        content: Buffer.from("test"),
        encryption: "A256GCM",
        initialisationVector: Buffer.from("iv"),
      };

      expect(isAesSerialisedData(data)).toBe(false);
    });

    it("should return false when at least one value is a Buffer", () => {
      const data = {
        content: "dGVzdA==",
        encryption: "A256GCM" as const,
        initialisationVector: Buffer.from("iv"),
      };

      expect(isAesSerialisedData(data as any)).toBe(false);
    });
  });

  describe("isAesTokenised", () => {
    it("should return true for valid tokenised string", () => {
      const validToken = "$v=1$alg=A256GCM$data$";

      expect(isAesTokenised(validToken)).toBe(true);
    });

    it("should return true when string starts with $, ends with $, and contains v= and alg=", () => {
      const validToken = "$v=2$alg=A128GCM$other=value$";

      expect(isAesTokenised(validToken)).toBe(true);
    });

    it("should return false when string does not start with $", () => {
      const invalidToken = "v=1$alg=A256GCM$data$";

      expect(isAesTokenised(invalidToken)).toBe(false);
    });

    it("should return false when string does not end with $", () => {
      const invalidToken = "$v=1$alg=A256GCM$data";

      expect(isAesTokenised(invalidToken)).toBe(false);
    });

    it("should return false when string does not contain v=", () => {
      const invalidToken = "$alg=A256GCM$data$";

      expect(isAesTokenised(invalidToken)).toBe(false);
    });

    it("should return false when string does not contain alg=", () => {
      const invalidToken = "$v=1$data$";

      expect(isAesTokenised(invalidToken)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isAesTokenised("")).toBe(false);
    });

    it("should return false for non-string input", () => {
      expect(isAesTokenised(null as any)).toBe(false);
      expect(isAesTokenised(undefined as any)).toBe(false);
      expect(isAesTokenised(123 as any)).toBe(false);
      expect(isAesTokenised({} as any)).toBe(false);
    });

    it("should return false when string contains only $", () => {
      expect(isAesTokenised("$")).toBe(false);
    });

    it("should return false when string is $$", () => {
      expect(isAesTokenised("$$")).toBe(false);
    });
  });
});
