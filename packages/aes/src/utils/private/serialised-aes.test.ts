import { B64 } from "@lindorm/b64";
import { createSerialisedAesRecord, parseSerialisedAesRecord } from "./serialised-aes";
import {
  AesEncryptionRecord,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "../../types";

describe("serialised-aes", () => {
  describe("createSerialisedAesRecord", () => {
    it("should convert AesEncryptionRecord to SerialisedAesEncryption with all fields", () => {
      const input: AesEncryptionRecord = {
        algorithm: "PBES2-HS512+A256KW",
        authTag: Buffer.from("auth-tag-data"),
        content: Buffer.from("encrypted-content"),
        contentType: "text/plain",
        encryption: "A256GCM",
        hkdfSalt: Buffer.from("hkdf-salt-data"),
        initialisationVector: Buffer.from("iv-data"),
        keyId: "key-id-123",
        pbkdfIterations: 10000,
        pbkdfSalt: Buffer.from("pbkdf-salt-data"),
        publicEncryptionIv: Buffer.from("public-iv"),
        publicEncryptionJwk: {
          crv: "P-256",
          kty: "EC",
          x: "x-coordinate",
          y: "y-coordinate",
        },
        publicEncryptionKey: Buffer.from("public-key"),
        publicEncryptionTag: Buffer.from("public-tag"),
        version: 1,
      };

      const result = createSerialisedAesRecord(input);

      expect(result).toEqual<SerialisedAesEncryption>({
        algorithm: "PBES2-HS512+A256KW",
        authTag: B64.encode(input.authTag),
        content: B64.encode(input.content),
        contentType: "text/plain",
        encryption: "A256GCM",
        hkdfSalt: B64.encode(input.hkdfSalt!),
        initialisationVector: B64.encode(input.initialisationVector),
        keyId: "key-id-123",
        pbkdfIterations: 10000,
        pbkdfSalt: B64.encode(input.pbkdfSalt!),
        publicEncryptionIv: B64.encode(input.publicEncryptionIv!),
        publicEncryptionJwk: {
          crv: "P-256",
          kty: "EC",
          x: "x-coordinate",
          y: "y-coordinate",
        },
        publicEncryptionKey: B64.encode(input.publicEncryptionKey!),
        publicEncryptionTag: B64.encode(input.publicEncryptionTag!),
        version: 1,
      });
    });

    it("should handle undefined optional fields", () => {
      const input: AesEncryptionRecord = {
        algorithm: "A256KW",
        authTag: Buffer.from("auth-tag"),
        content: Buffer.from("content"),
        contentType: "application/json",
        encryption: "A128GCM",
        hkdfSalt: undefined,
        initialisationVector: Buffer.from("iv"),
        keyId: "key-123",
        pbkdfIterations: undefined,
        pbkdfSalt: undefined,
        publicEncryptionIv: undefined,
        publicEncryptionJwk: undefined,
        publicEncryptionKey: undefined,
        publicEncryptionTag: undefined,
        version: 2,
      };

      const result = createSerialisedAesRecord(input);

      expect(result).toEqual<SerialisedAesEncryption>({
        algorithm: "A256KW",
        authTag: B64.encode(input.authTag),
        content: B64.encode(input.content),
        contentType: "application/json",
        encryption: "A128GCM",
        hkdfSalt: undefined,
        initialisationVector: B64.encode(input.initialisationVector),
        keyId: "key-123",
        pbkdfIterations: undefined,
        pbkdfSalt: undefined,
        publicEncryptionIv: undefined,
        publicEncryptionJwk: undefined,
        publicEncryptionKey: undefined,
        publicEncryptionTag: undefined,
        version: 2,
      });

      expect(result.hkdfSalt).toBeUndefined();
      expect(result.pbkdfIterations).toBeUndefined();
      expect(result.pbkdfSalt).toBeUndefined();
      expect(result.publicEncryptionIv).toBeUndefined();
      expect(result.publicEncryptionJwk).toBeUndefined();
      expect(result.publicEncryptionKey).toBeUndefined();
      expect(result.publicEncryptionTag).toBeUndefined();
    });

    it("should correctly encode Buffers to base64url strings", () => {
      const testBuffer = Buffer.from("test-data-123");
      const input: AesEncryptionRecord = {
        algorithm: "RSA-OAEP",
        authTag: testBuffer,
        content: testBuffer,
        contentType: "text/plain",
        encryption: "A256GCM",
        hkdfSalt: undefined,
        initialisationVector: testBuffer,
        keyId: "key",
        pbkdfIterations: undefined,
        pbkdfSalt: undefined,
        publicEncryptionIv: undefined,
        publicEncryptionJwk: undefined,
        publicEncryptionKey: undefined,
        publicEncryptionTag: undefined,
        version: 1,
      };

      const result = createSerialisedAesRecord(input);
      const expectedEncoded = B64.encode(testBuffer);

      expect(result.authTag).toBe(expectedEncoded);
      expect(result.content).toBe(expectedEncoded);
      expect(result.initialisationVector).toBe(expectedEncoded);
      expect(typeof result.authTag).toBe("string");
      expect(typeof result.content).toBe("string");
      expect(typeof result.initialisationVector).toBe("string");
    });
  });

  describe("parseSerialisedAesRecord", () => {
    it("should convert SerialisedAesDecryption to AesDecryptionRecord with all fields", () => {
      const authTagBuffer = Buffer.from("auth-tag-data");
      const contentBuffer = Buffer.from("encrypted-content");
      const hkdfSaltBuffer = Buffer.from("hkdf-salt-data");
      const ivBuffer = Buffer.from("iv-data");
      const pbkdfSaltBuffer = Buffer.from("pbkdf-salt-data");
      const publicIvBuffer = Buffer.from("public-iv");
      const publicKeyBuffer = Buffer.from("public-key");
      const publicTagBuffer = Buffer.from("public-tag");

      const input: SerialisedAesDecryption = {
        algorithm: "PBES2-HS512+A256KW",
        authTag: B64.encode(authTagBuffer),
        content: B64.encode(contentBuffer),
        contentType: "text/plain",
        encryption: "A256GCM",
        hkdfSalt: B64.encode(hkdfSaltBuffer),
        initialisationVector: B64.encode(ivBuffer),
        keyId: "key-id-123",
        pbkdfIterations: 10000,
        pbkdfSalt: B64.encode(pbkdfSaltBuffer),
        publicEncryptionIv: B64.encode(publicIvBuffer),
        publicEncryptionJwk: {
          crv: "P-256",
          kty: "EC",
          x: "x-coordinate",
          y: "y-coordinate",
        },
        publicEncryptionKey: B64.encode(publicKeyBuffer),
        publicEncryptionTag: B64.encode(publicTagBuffer),
        version: 1,
      };

      const result = parseSerialisedAesRecord(input);

      expect(result.algorithm).toBe("PBES2-HS512+A256KW");
      expect(result.authTag).toBeInstanceOf(Buffer);
      expect(result.authTag).toEqual(authTagBuffer);
      expect(result.content).toBeInstanceOf(Buffer);
      expect(result.content).toEqual(contentBuffer);
      expect(result.contentType).toBe("text/plain");
      expect(result.encryption).toBe("A256GCM");
      expect(result.hkdfSalt).toBeInstanceOf(Buffer);
      expect(result.hkdfSalt).toEqual(hkdfSaltBuffer);
      expect(result.initialisationVector).toBeInstanceOf(Buffer);
      expect(result.initialisationVector).toEqual(ivBuffer);
      expect(result.keyId).toBe("key-id-123");
      expect(result.pbkdfIterations).toBe(10000);
      expect(result.pbkdfSalt).toBeInstanceOf(Buffer);
      expect(result.pbkdfSalt).toEqual(pbkdfSaltBuffer);
      expect(result.publicEncryptionIv).toBeInstanceOf(Buffer);
      expect(result.publicEncryptionIv).toEqual(publicIvBuffer);
      expect(result.publicEncryptionJwk).toEqual({
        crv: "P-256",
        kty: "EC",
        x: "x-coordinate",
        y: "y-coordinate",
      });
      expect(result.publicEncryptionKey).toBeInstanceOf(Buffer);
      expect(result.publicEncryptionKey).toEqual(publicKeyBuffer);
      expect(result.publicEncryptionTag).toBeInstanceOf(Buffer);
      expect(result.publicEncryptionTag).toEqual(publicTagBuffer);
      expect(result.version).toBe(1);
    });

    it("should handle undefined optional fields", () => {
      const input: SerialisedAesDecryption = {
        algorithm: undefined,
        authTag: undefined,
        content: B64.encode(Buffer.from("content")),
        contentType: undefined,
        encryption: "A128GCM",
        hkdfSalt: undefined,
        initialisationVector: B64.encode(Buffer.from("iv")),
        keyId: undefined,
        pbkdfIterations: undefined,
        pbkdfSalt: undefined,
        publicEncryptionIv: undefined,
        publicEncryptionJwk: undefined,
        publicEncryptionKey: undefined,
        publicEncryptionTag: undefined,
        version: undefined,
      };

      const result = parseSerialisedAesRecord(input);

      expect(result.algorithm).toBeUndefined();
      expect(result.authTag).toBeUndefined();
      expect(result.content).toBeInstanceOf(Buffer);
      expect(result.contentType).toBeUndefined();
      expect(result.encryption).toBe("A128GCM");
      expect(result.hkdfSalt).toBeUndefined();
      expect(result.initialisationVector).toBeInstanceOf(Buffer);
      expect(result.keyId).toBeUndefined();
      expect(result.pbkdfIterations).toBeUndefined();
      expect(result.pbkdfSalt).toBeUndefined();
      expect(result.publicEncryptionIv).toBeUndefined();
      expect(result.publicEncryptionJwk).toBeUndefined();
      expect(result.publicEncryptionKey).toBeUndefined();
      expect(result.publicEncryptionTag).toBeUndefined();
      expect(result.version).toBeUndefined();
    });

    it("should correctly decode base64url strings to Buffers", () => {
      const testBuffer = Buffer.from("test-data-456");
      const encoded = B64.encode(testBuffer);

      const input: SerialisedAesDecryption = {
        content: encoded,
        encryption: "A256GCM",
        initialisationVector: encoded,
        authTag: encoded,
      };

      const result = parseSerialisedAesRecord(input);

      expect(result.content).toEqual(testBuffer);
      expect(result.initialisationVector).toEqual(testBuffer);
      expect(result.authTag).toEqual(testBuffer);
    });
  });

  describe("round-trip conversion", () => {
    it("should handle round-trip conversion with all fields populated", () => {
      const original: AesEncryptionRecord = {
        algorithm: "ECDH-ES+A256KW",
        authTag: Buffer.from("auth-tag-round-trip"),
        content: Buffer.from("content-round-trip"),
        contentType: "application/octet-stream",
        encryption: "A192GCM",
        hkdfSalt: Buffer.from("hkdf-salt-round-trip"),
        initialisationVector: Buffer.from("iv-round-trip"),
        keyId: "round-trip-key",
        pbkdfIterations: 5000,
        pbkdfSalt: Buffer.from("pbkdf-salt-round-trip"),
        publicEncryptionIv: Buffer.from("pub-iv-round-trip"),
        publicEncryptionJwk: {
          crv: "P-384",
          kty: "EC",
          x: "x-value",
          y: "y-value",
        },
        publicEncryptionKey: Buffer.from("pub-key-round-trip"),
        publicEncryptionTag: Buffer.from("pub-tag-round-trip"),
        version: 3,
      };

      const serialised = createSerialisedAesRecord(original);
      const parsed = parseSerialisedAesRecord(serialised);

      expect(parsed.algorithm).toBe(original.algorithm);
      expect(parsed.authTag).toEqual(original.authTag);
      expect(parsed.content).toEqual(original.content);
      expect(parsed.contentType).toBe(original.contentType);
      expect(parsed.encryption).toBe(original.encryption);
      expect(parsed.hkdfSalt).toEqual(original.hkdfSalt);
      expect(parsed.initialisationVector).toEqual(original.initialisationVector);
      expect(parsed.keyId).toBe(original.keyId);
      expect(parsed.pbkdfIterations).toBe(original.pbkdfIterations);
      expect(parsed.pbkdfSalt).toEqual(original.pbkdfSalt);
      expect(parsed.publicEncryptionIv).toEqual(original.publicEncryptionIv);
      expect(parsed.publicEncryptionJwk).toEqual(original.publicEncryptionJwk);
      expect(parsed.publicEncryptionKey).toEqual(original.publicEncryptionKey);
      expect(parsed.publicEncryptionTag).toEqual(original.publicEncryptionTag);
      expect(parsed.version).toBe(original.version);
    });

    it("should handle round-trip conversion with optional fields undefined", () => {
      const original: AesEncryptionRecord = {
        algorithm: "RSA-OAEP-256",
        authTag: Buffer.from("auth"),
        content: Buffer.from("content"),
        contentType: "text/plain",
        encryption: "A256GCM",
        hkdfSalt: undefined,
        initialisationVector: Buffer.from("iv"),
        keyId: "key",
        pbkdfIterations: undefined,
        pbkdfSalt: undefined,
        publicEncryptionIv: undefined,
        publicEncryptionJwk: undefined,
        publicEncryptionKey: undefined,
        publicEncryptionTag: undefined,
        version: 1,
      };

      const serialised = createSerialisedAesRecord(original);
      const parsed = parseSerialisedAesRecord(serialised);

      expect(parsed.algorithm).toBe(original.algorithm);
      expect(parsed.authTag).toEqual(original.authTag);
      expect(parsed.content).toEqual(original.content);
      expect(parsed.contentType).toBe(original.contentType);
      expect(parsed.encryption).toBe(original.encryption);
      expect(parsed.hkdfSalt).toBeUndefined();
      expect(parsed.initialisationVector).toEqual(original.initialisationVector);
      expect(parsed.keyId).toBe(original.keyId);
      expect(parsed.pbkdfIterations).toBeUndefined();
      expect(parsed.pbkdfSalt).toBeUndefined();
      expect(parsed.publicEncryptionIv).toBeUndefined();
      expect(parsed.publicEncryptionJwk).toBeUndefined();
      expect(parsed.publicEncryptionKey).toBeUndefined();
      expect(parsed.publicEncryptionTag).toBeUndefined();
      expect(parsed.version).toBe(original.version);
    });

    it("should preserve buffer equality after round-trip", () => {
      const contentBuffer = Buffer.from("important-data-12345");
      const original: AesEncryptionRecord = {
        algorithm: "A128KW",
        authTag: Buffer.from("tag"),
        content: contentBuffer,
        contentType: "application/json",
        encryption: "A128GCM",
        hkdfSalt: undefined,
        initialisationVector: Buffer.from("initialization-vector"),
        keyId: "test-key",
        pbkdfIterations: undefined,
        pbkdfSalt: undefined,
        publicEncryptionIv: undefined,
        publicEncryptionJwk: undefined,
        publicEncryptionKey: undefined,
        publicEncryptionTag: undefined,
        version: 1,
      };

      const serialised = createSerialisedAesRecord(original);
      const parsed = parseSerialisedAesRecord(serialised);

      expect(Buffer.compare(parsed.content, contentBuffer)).toBe(0);
      expect(parsed.content.toString()).toBe(contentBuffer.toString());
    });
  });
});
