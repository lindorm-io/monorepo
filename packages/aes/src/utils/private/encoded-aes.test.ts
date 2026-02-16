import { KryptosEncAlgorithm, KryptosKit } from "@lindorm/kryptos";
import { createEncodedAesString, parseEncodedAesString } from "./encoded-aes";
import { encryptAes } from "./encryption";

describe("encoded-aes", () => {
  test("should create and parse an encoded string with CEK (key-wrap mode)", () => {
    const kryptos = KryptosKit.generate.auto({ algorithm: "PBES2-HS512+A256KW" });
    const data = encryptAes({ data: "test", kryptos });

    const encoded = createEncodedAesString(data);
    expect(encoded).toEqual(expect.any(String));

    const decoded = parseEncodedAesString(encoded);
    expect(decoded.algorithm).toBe(data.algorithm);
    expect(decoded.encryption).toBe(data.encryption);
    expect(decoded.keyId).toBe(data.keyId);
    expect(decoded.content).toEqual(data.content);
    expect(decoded.authTag).toEqual(data.authTag);
    expect(decoded.initialisationVector).toEqual(data.initialisationVector);
    expect(decoded.version).toBe(data.version);
    expect(decoded.aad).toBeInstanceOf(Buffer);
  });

  test("should create and parse an encoded string without CEK (dir mode)", () => {
    const kryptos = KryptosKit.generate.enc.oct({
      algorithm: "dir",
      encryption: "A256GCM",
    });
    const data = encryptAes({ data: "test", kryptos });

    const encoded = createEncodedAesString(data);
    expect(encoded).toEqual(expect.any(String));

    const decoded = parseEncodedAesString(encoded);
    expect(decoded.algorithm).toBe("dir");
    expect(decoded.publicEncryptionKey).toBeUndefined();
    expect(decoded.content).toEqual(data.content);
    expect(decoded.aad).toBeInstanceOf(Buffer);
  });

  test("should round-trip encode and decode preserving all fields", () => {
    const original = {
      algorithm: "PBES2-HS512+A256KW" as const,
      authTag: Buffer.alloc(16, 0xaa), // 16 bytes for GCM tag
      content: Buffer.from("test-ciphertext"),
      contentType: "text/plain" as const,
      encryption: "A256GCM" as const,
      initialisationVector: Buffer.alloc(12, 0xbb), // 12 bytes for GCM IV
      keyId: "c03b589b-124d-45eb-8376-d7f0576811ff",
      pbkdfIterations: 95959,
      pbkdfSalt: Buffer.from("some-salt"),
      publicEncryptionIv: undefined,
      publicEncryptionJwk: undefined,
      publicEncryptionKey: Buffer.from("wrapped-cek-data"),
      publicEncryptionTag: undefined,
      version: "1.0",
    };

    const encoded = createEncodedAesString(original);
    const decoded = parseEncodedAesString(encoded);

    expect(decoded.algorithm).toBe(original.algorithm);
    expect(decoded.authTag).toEqual(original.authTag);
    expect(decoded.content).toEqual(original.content);
    expect(decoded.contentType).toBe(original.contentType);
    expect(decoded.encryption).toBe(original.encryption);
    expect(decoded.initialisationVector).toEqual(original.initialisationVector);
    expect(decoded.keyId).toBe(original.keyId);
    expect(decoded.pbkdfIterations).toBe(original.pbkdfIterations);
    expect(decoded.pbkdfSalt).toEqual(original.pbkdfSalt);
    expect(decoded.publicEncryptionKey).toEqual(original.publicEncryptionKey);
    expect(decoded.version).toBe(original.version);
  });

  test("should round-trip with A256CBC-HS512 (16-byte IV, 32-byte tag)", () => {
    const original = {
      algorithm: "A256KW" as const,
      authTag: Buffer.alloc(32, 0xcc), // 32 bytes for A256CBC-HS512 (SHA512/2)
      content: Buffer.from("cbc-ciphertext"),
      contentType: "text/plain" as const,
      encryption: "A256CBC-HS512" as const,
      initialisationVector: Buffer.alloc(16, 0xdd), // 16 bytes for CBC IV
      keyId: "test-key-id",
      pbkdfIterations: undefined,
      pbkdfSalt: undefined,
      publicEncryptionIv: undefined,
      publicEncryptionJwk: undefined,
      publicEncryptionKey: Buffer.from("wrapped-cek"),
      publicEncryptionTag: undefined,
      version: "1.0",
    };

    const encoded = createEncodedAesString(original);
    const decoded = parseEncodedAesString(encoded);

    expect(decoded.authTag).toEqual(original.authTag);
    expect(decoded.initialisationVector).toEqual(original.initialisationVector);
    expect(decoded.content).toEqual(original.content);
  });

  test("should round-trip with A128CBC-HS256 (16-byte IV, 16-byte tag)", () => {
    const original = {
      algorithm: "A128KW" as const,
      authTag: Buffer.alloc(16, 0xcc), // 16 bytes for A128CBC-HS256 (SHA256/2)
      content: Buffer.from("cbc-ciphertext"),
      contentType: "text/plain" as const,
      encryption: "A128CBC-HS256" as const,
      initialisationVector: Buffer.alloc(16, 0xdd), // 16 bytes for CBC IV
      keyId: "test-key-id",
      pbkdfIterations: undefined,
      pbkdfSalt: undefined,
      publicEncryptionIv: undefined,
      publicEncryptionJwk: undefined,
      publicEncryptionKey: Buffer.from("wrapped-cek"),
      publicEncryptionTag: undefined,
      version: "1.0",
    };

    const encoded = createEncodedAesString(original);
    const decoded = parseEncodedAesString(encoded);

    expect(decoded.authTag).toEqual(original.authTag);
    expect(decoded.initialisationVector).toEqual(original.initialisationVector);
    expect(decoded.content).toEqual(original.content);
  });

  describe("algorithms", () => {
    const algorithms: Array<KryptosEncAlgorithm> = [
      "ECDH-ES",
      "ECDH-ES+A128KW",
      "ECDH-ES+A192KW",
      "ECDH-ES+A256KW",
      "ECDH-ES+A128GCMKW",
      "ECDH-ES+A192GCMKW",
      "ECDH-ES+A256GCMKW",
      "A128KW",
      "A192KW",
      "A256KW",
      "A128GCMKW",
      "A192GCMKW",
      "A256GCMKW",
      "PBES2-HS256+A128KW",
      "PBES2-HS384+A192KW",
      "PBES2-HS512+A256KW",
      "RSA-OAEP",
      "RSA-OAEP-256",
      "RSA-OAEP-384",
      "RSA-OAEP-512",
    ];

    test.each(algorithms)("should encode and decode %s", (algorithm) => {
      const kryptos = KryptosKit.generate.auto({ algorithm });
      const data = encryptAes({ data: "test", kryptos });
      const encoded = createEncodedAesString(data);
      const decoded = parseEncodedAesString(encoded);

      expect(encoded).toEqual(expect.any(String));
      expect(decoded.algorithm).toBe(data.algorithm);
      expect(decoded.encryption).toBe(data.encryption);
      expect(decoded.content).toEqual(data.content);
      expect(decoded.authTag).toEqual(data.authTag);
      expect(decoded.initialisationVector).toEqual(data.initialisationVector);
      expect(decoded.aad).toBeInstanceOf(Buffer);
    });
  });
});
