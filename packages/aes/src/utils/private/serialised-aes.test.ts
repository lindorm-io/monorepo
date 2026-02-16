import { KryptosEncAlgorithm, KryptosKit } from "@lindorm/kryptos";
import { AesEncryptionRecord, SerialisedAesEncryption } from "../../types";
import { encryptAes } from "./encryption";
import { createSerialisedAesRecord, parseSerialisedAesRecord } from "./serialised-aes";

describe("serialised-aes", () => {
  describe("createSerialisedAesRecord", () => {
    test("should convert AesEncryptionRecord to SerialisedAesEncryption with header-based format", () => {
      const input: AesEncryptionRecord = {
        algorithm: "PBES2-HS512+A256KW",
        authTag: Buffer.from("auth-tag-data"),
        content: Buffer.from("encrypted-content"),
        contentType: "text/plain",
        encryption: "A256GCM",
        initialisationVector: Buffer.from("iv-data-12ch"),
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
        version: "1.0",
      };

      const result = createSerialisedAesRecord(input);

      expect(result).toEqual<SerialisedAesEncryption>({
        cek: expect.any(String),
        ciphertext: expect.any(String),
        header: expect.any(String),
        iv: expect.any(String),
        tag: expect.any(String),
        v: "1.0",
      });

      // header should be a base64url string
      expect(typeof result.header).toBe("string");
      expect(result.header.length).toBeGreaterThan(0);

      // cek should be present for key-wrap modes
      expect(result.cek).toBeDefined();
    });

    test("should handle undefined optional fields (dir mode)", () => {
      const input: AesEncryptionRecord = {
        algorithm: "dir",
        authTag: Buffer.from("auth-tag"),
        content: Buffer.from("content"),
        contentType: "application/json",
        encryption: "A128GCM",
        initialisationVector: Buffer.from("iv-data-12ch"),
        keyId: "key-123",
        pbkdfIterations: undefined,
        pbkdfSalt: undefined,
        publicEncryptionIv: undefined,
        publicEncryptionJwk: undefined,
        publicEncryptionKey: undefined,
        publicEncryptionTag: undefined,
        version: "1.0",
      };

      const result = createSerialisedAesRecord(input);

      expect(result.cek).toBeUndefined();
      expect(result.header).toEqual(expect.any(String));
      expect(result.v).toBe("1.0");
    });
  });

  describe("parseSerialisedAesRecord", () => {
    test("should convert SerialisedAesDecryption to AesDecryptionRecord", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
      const data = encryptAes({ data: "test", kryptos });
      const serialised = createSerialisedAesRecord(data);
      const parsed = parseSerialisedAesRecord(serialised);

      expect(parsed.algorithm).toBe(data.algorithm);
      expect(parsed.authTag).toEqual(data.authTag);
      expect(parsed.content).toEqual(data.content);
      expect(parsed.contentType).toBe(data.contentType);
      expect(parsed.encryption).toBe(data.encryption);
      expect(parsed.initialisationVector).toEqual(data.initialisationVector);
      expect(parsed.keyId).toBe(data.keyId);
      expect(parsed.publicEncryptionKey).toEqual(data.publicEncryptionKey);
      expect(parsed.version).toBe(data.version);
      expect(parsed.aad).toBeInstanceOf(Buffer);
    });

    test("should handle dir mode (no CEK)", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "A256GCM",
      });
      const data = encryptAes({ data: "test", kryptos });
      const serialised = createSerialisedAesRecord(data);
      const parsed = parseSerialisedAesRecord(serialised);

      expect(parsed.algorithm).toBe("dir");
      expect(parsed.publicEncryptionKey).toBeUndefined();
      expect(parsed.aad).toBeInstanceOf(Buffer);
    });
  });

  describe("round-trip conversion", () => {
    test("should handle round-trip conversion with all fields populated", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "ECDH-ES+A256KW" });
      const original = encryptAes({
        data: "round-trip-test",
        encryption: "A192GCM",
        kryptos,
      });

      const serialised = createSerialisedAesRecord(original);
      const parsed = parseSerialisedAesRecord(serialised);

      expect(parsed.algorithm).toBe(original.algorithm);
      expect(parsed.authTag).toEqual(original.authTag);
      expect(parsed.content).toEqual(original.content);
      expect(parsed.contentType).toBe(original.contentType);
      expect(parsed.encryption).toBe(original.encryption);
      expect(parsed.initialisationVector).toEqual(original.initialisationVector);
      expect(parsed.keyId).toBe(original.keyId);
      expect(parsed.publicEncryptionJwk).toEqual(original.publicEncryptionJwk);
      expect(parsed.version).toBe(original.version);
    });

    test("should handle round-trip conversion with optional fields undefined", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "A256GCM",
      });
      const original = encryptAes({ data: "test", kryptos });

      const serialised = createSerialisedAesRecord(original);
      const parsed = parseSerialisedAesRecord(serialised);

      expect(parsed.algorithm).toBe(original.algorithm);
      expect(parsed.authTag).toEqual(original.authTag);
      expect(parsed.content).toEqual(original.content);
      expect(parsed.encryption).toBe(original.encryption);
      expect(parsed.publicEncryptionKey).toBeUndefined();
      expect(parsed.version).toBe(original.version);
    });

    describe("algorithms", () => {
      const algorithms: Array<KryptosEncAlgorithm> = [
        "ECDH-ES",
        "ECDH-ES+A128KW",
        "A128KW",
        "A128GCMKW",
        "PBES2-HS256+A128KW",
        "RSA-OAEP-256",
      ];

      test.each(algorithms)(
        "should round-trip serialise and parse for %s",
        (algorithm) => {
          const kryptos = KryptosKit.generate.auto({ algorithm });
          const original = encryptAes({ data: "test", kryptos });
          const serialised = createSerialisedAesRecord(original);
          const parsed = parseSerialisedAesRecord(serialised);

          expect(parsed.algorithm).toBe(original.algorithm);
          expect(parsed.content).toEqual(original.content);
          expect(parsed.authTag).toEqual(original.authTag);
          expect(parsed.initialisationVector).toEqual(original.initialisationVector);
          expect(parsed.aad).toBeInstanceOf(Buffer);
        },
      );
    });
  });
});
