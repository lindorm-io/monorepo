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

  describe("error handling", () => {
    test("should throw for truncated binary (missing header length)", () => {
      const buffer = Buffer.from([0x00]); // Only 1 byte, needs at least 2
      const encoded = require("@lindorm/b64").B64.encode(buffer, "b64u");

      expect(() => parseEncodedAesString(encoded)).toThrow("missing header length");
    });

    test("should throw for header exceeding buffer", () => {
      const buffer = Buffer.alloc(4);
      buffer.writeUInt16BE(100, 0); // Header length = 100, but buffer only has 4 bytes
      const encoded = require("@lindorm/b64").B64.encode(buffer, "b64u");

      expect(() => parseEncodedAesString(encoded)).toThrow("header exceeds buffer");
    });

    test("should throw for missing CEK length", () => {
      const headerJson = JSON.stringify({ alg: "dir", enc: "A256GCM", v: "1.0" });
      const headerBuf = Buffer.from(headerJson, "utf8");
      const buffer = Buffer.alloc(2 + headerBuf.length);
      buffer.writeUInt16BE(headerBuf.length, 0);
      headerBuf.copy(buffer, 2);
      // No CEK length field (needs 2 more bytes)
      const encoded = require("@lindorm/b64").B64.encode(buffer, "b64u");

      expect(() => parseEncodedAesString(encoded)).toThrow("missing CEK length");
    });

    test("should throw for CEK exceeding buffer", () => {
      const headerJson = JSON.stringify({ alg: "dir", enc: "A256GCM", v: "1.0" });
      const headerBuf = Buffer.from(headerJson, "utf8");
      const buffer = Buffer.alloc(2 + headerBuf.length + 2);
      buffer.writeUInt16BE(headerBuf.length, 0);
      headerBuf.copy(buffer, 2);
      buffer.writeUInt16BE(100, 2 + headerBuf.length); // CEK length = 100, but no data
      const encoded = require("@lindorm/b64").B64.encode(buffer, "b64u");

      expect(() => parseEncodedAesString(encoded)).toThrow("CEK exceeds buffer");
    });

    test("should throw for IV exceeding buffer", () => {
      const headerJson = JSON.stringify({
        alg: "dir",
        enc: "A256GCM",
        v: "1.0",
        kid: "test",
        cty: "text/plain",
      });
      const headerBuf = Buffer.from(headerJson, "utf8");
      const buffer = Buffer.alloc(2 + headerBuf.length + 2); // No IV data
      buffer.writeUInt16BE(headerBuf.length, 0);
      headerBuf.copy(buffer, 2);
      buffer.writeUInt16BE(0, 2 + headerBuf.length); // CEK length = 0 (dir mode)
      const encoded = require("@lindorm/b64").B64.encode(buffer, "b64u");

      expect(() => parseEncodedAesString(encoded)).toThrow("IV exceeds buffer");
    });

    test("should throw for tag exceeding buffer", () => {
      const headerJson = JSON.stringify({
        alg: "dir",
        enc: "A256GCM",
        v: "1.0",
        kid: "test",
        cty: "text/plain",
      });
      const headerBuf = Buffer.from(headerJson, "utf8");
      const ivSize = 12; // GCM IV
      const buffer = Buffer.alloc(2 + headerBuf.length + 2 + ivSize); // No tag data
      buffer.writeUInt16BE(headerBuf.length, 0);
      headerBuf.copy(buffer, 2);
      buffer.writeUInt16BE(0, 2 + headerBuf.length); // CEK length = 0
      const encoded = require("@lindorm/b64").B64.encode(buffer, "b64u");

      expect(() => parseEncodedAesString(encoded)).toThrow("tag exceeds buffer");
    });

    test("should throw for corrupted binary data", () => {
      expect(() => parseEncodedAesString("!!!invalid!!!")).toThrow();
    });

    test("should throw for invalid JSON in header", () => {
      const invalidJson = Buffer.from("not-json", "utf8");
      const buffer = Buffer.alloc(2 + invalidJson.length);
      buffer.writeUInt16BE(invalidJson.length, 0);
      invalidJson.copy(buffer, 2);
      const encoded = require("@lindorm/b64").B64.encode(buffer, "b64u");

      expect(() => parseEncodedAesString(encoded)).toThrow();
    });

    test("should throw for missing required header fields", () => {
      const headerJson = JSON.stringify({ v: "1.0" }); // Missing alg, enc
      const headerBuf = Buffer.from(headerJson, "utf8");
      const buffer = Buffer.alloc(2 + headerBuf.length + 2 + 12 + 16 + 10);
      buffer.writeUInt16BE(headerBuf.length, 0);
      headerBuf.copy(buffer, 2);
      buffer.writeUInt16BE(0, 2 + headerBuf.length);
      const encoded = require("@lindorm/b64").B64.encode(buffer, "b64u");

      expect(() => parseEncodedAesString(encoded)).toThrow("missing required fields");
    });

    test("should throw for future version (v: 2.0)", () => {
      const headerJson = JSON.stringify({
        alg: "dir",
        enc: "A256GCM",
        v: "2.0",
        kid: "test",
        cty: "text/plain",
      });
      const headerBuf = Buffer.from(headerJson, "utf8");
      const buffer = Buffer.alloc(2 + headerBuf.length + 2 + 12 + 16 + 10);
      buffer.writeUInt16BE(headerBuf.length, 0);
      headerBuf.copy(buffer, 2);
      buffer.writeUInt16BE(0, 2 + headerBuf.length);
      const encoded = require("@lindorm/b64").B64.encode(buffer, "b64u");

      expect(() => parseEncodedAesString(encoded)).toThrow("Incompatible AES version");
    });

    test("should throw for legacy version (v: 11)", () => {
      const headerJson = JSON.stringify({
        alg: "dir",
        enc: "A256GCM",
        v: "11",
        kid: "test",
        cty: "text/plain",
      });
      const headerBuf = Buffer.from(headerJson, "utf8");
      const buffer = Buffer.alloc(2 + headerBuf.length + 2 + 12 + 16 + 10);
      buffer.writeUInt16BE(headerBuf.length, 0);
      headerBuf.copy(buffer, 2);
      buffer.writeUInt16BE(0, 2 + headerBuf.length);
      const encoded = require("@lindorm/b64").B64.encode(buffer, "b64u");

      expect(() => parseEncodedAesString(encoded)).toThrow(
        "Legacy AES version format is no longer supported",
      );
    });
  });

  describe("tamper-detection tests (CRITICAL)", () => {
    describe("GCM mode", () => {
      test("should detect tampered header data", () => {
        const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
        const data = encryptAes({ data: "test", kryptos });
        const encoded = createEncodedAesString(data);

        const buffer = require("@lindorm/b64").B64.toBuffer(encoded, "b64u");

        // Read header length and compute original AAD
        const headerLength = buffer.readUInt16BE(0);
        const headerStart = 2;
        const headerJson = buffer.subarray(headerStart, headerStart + headerLength);
        const originalAad = require("@lindorm/b64").B64.encode(headerJson, "b64u");

        // Tamper with header JSON (change a byte) - this will make JSON invalid
        buffer[headerStart] ^= 0xff;

        const tamperedEncoded = require("@lindorm/b64").B64.encode(buffer, "b64u");

        // Should throw because header JSON is now invalid
        expect(() => parseEncodedAesString(tamperedEncoded)).toThrow();
      });

      test("should detect tampered ciphertext", () => {
        const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
        const data = encryptAes({ data: "test", kryptos });
        const encoded = createEncodedAesString(data);

        const buffer = require("@lindorm/b64").B64.toBuffer(encoded, "b64u");

        // Tamper with last byte (part of ciphertext)
        buffer[buffer.length - 1] ^= 0xff;

        const tamperedEncoded = require("@lindorm/b64").B64.encode(buffer, "b64u");

        const parsed = parseEncodedAesString(tamperedEncoded);
        expect(parsed.content).not.toEqual(data.content);
      });

      test("should detect tampered auth tag", () => {
        const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
        const data = encryptAes({ data: "test", kryptos });
        const encoded = createEncodedAesString(data);

        const buffer = require("@lindorm/b64").B64.toBuffer(encoded, "b64u");

        // Find tag position (after header + CEK + IV, before ciphertext)
        const headerLength = buffer.readUInt16BE(0);
        const cekLength = buffer.readUInt16BE(2 + headerLength);
        const ivSize = 12; // GCM
        const tagStart = 2 + headerLength + 2 + cekLength + ivSize;

        // Tamper with tag
        buffer[tagStart] ^= 0xff;

        const tamperedEncoded = require("@lindorm/b64").B64.encode(buffer, "b64u");

        const parsed = parseEncodedAesString(tamperedEncoded);
        expect(parsed.authTag).not.toEqual(data.authTag);
      });
    });

    describe("CBC-HMAC mode", () => {
      test("should detect tampered header in CBC mode (A128CBC-HS256)", () => {
        const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
        const data = encryptAes({ data: "test", kryptos, encryption: "A128CBC-HS256" });
        const encoded = createEncodedAesString(data);

        const buffer = require("@lindorm/b64").B64.toBuffer(encoded, "b64u");

        // Tamper with header JSON - this will make it invalid
        buffer[2] ^= 0xff;

        const tamperedEncoded = require("@lindorm/b64").B64.encode(buffer, "b64u");

        // Should throw because header JSON is now invalid
        expect(() => parseEncodedAesString(tamperedEncoded)).toThrow();
      });

      test("should detect tampered ciphertext in CBC mode (A256CBC-HS512)", () => {
        const kryptos = KryptosKit.generate.auto({ algorithm: "A256KW" });
        const data = encryptAes({ data: "test", kryptos, encryption: "A256CBC-HS512" });
        const encoded = createEncodedAesString(data);

        const buffer = require("@lindorm/b64").B64.toBuffer(encoded, "b64u");

        // Tamper with ciphertext (last byte)
        buffer[buffer.length - 1] ^= 0x01;

        const tamperedEncoded = require("@lindorm/b64").B64.encode(buffer, "b64u");

        const parsed = parseEncodedAesString(tamperedEncoded);
        expect(parsed.content).not.toEqual(data.content);
      });
    });
  });

  describe("AAD round-trip tests", () => {
    test("should have non-empty AAD after parsing", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
      const data = encryptAes({ data: "test", kryptos });
      const encoded = createEncodedAesString(data);

      const parsed = parseEncodedAesString(encoded);

      expect(parsed.aad).toBeInstanceOf(Buffer);
      expect(parsed.aad.length).toBeGreaterThan(0);
    });

    test("should have AAD matching header JSON base64url encoding", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
      const data = encryptAes({ data: "test", kryptos });
      const encoded = createEncodedAesString(data);

      const buffer = require("@lindorm/b64").B64.toBuffer(encoded, "b64u");
      const headerLength = buffer.readUInt16BE(0);
      const headerJson = buffer.subarray(2, 2 + headerLength);
      const expectedAad = require("@lindorm/b64").B64.encode(headerJson, "b64u");

      const parsed = parseEncodedAesString(encoded);

      expect(parsed.aad.toString("ascii")).toBe(expectedAad);
    });

    test("should compute same AAD for GCM and CBC modes", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });

      const gcmData = encryptAes({ data: "test", kryptos, encryption: "A128GCM" });
      const cbcData = encryptAes({ data: "test", kryptos, encryption: "A128CBC-HS256" });

      const gcmEncoded = createEncodedAesString(gcmData);
      const cbcEncoded = createEncodedAesString(cbcData);

      const gcmParsed = parseEncodedAesString(gcmEncoded);
      const cbcParsed = parseEncodedAesString(cbcEncoded);

      // Both should have AAD
      expect(gcmParsed.aad).toBeInstanceOf(Buffer);
      expect(cbcParsed.aad).toBeInstanceOf(Buffer);
      expect(gcmParsed.aad.length).toBeGreaterThan(0);
      expect(cbcParsed.aad.length).toBeGreaterThan(0);
    });
  });

  describe("variable segment tests", () => {
    test("dir mode should have 0 CEK length", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "A256GCM",
      });
      const data = encryptAes({ data: "test", kryptos });
      const encoded = createEncodedAesString(data);

      const buffer = require("@lindorm/b64").B64.toBuffer(encoded, "b64u");
      const headerLength = buffer.readUInt16BE(0);
      const cekLength = buffer.readUInt16BE(2 + headerLength);

      expect(cekLength).toBe(0);
    });

    test("ECDH-ES mode should have 0 CEK length", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "ECDH-ES" });
      const data = encryptAes({ data: "test", kryptos });
      const encoded = createEncodedAesString(data);

      const buffer = require("@lindorm/b64").B64.toBuffer(encoded, "b64u");
      const headerLength = buffer.readUInt16BE(0);
      const cekLength = buffer.readUInt16BE(2 + headerLength);

      expect(cekLength).toBe(0);
    });

    test("RSA-OAEP mode should have non-zero CEK length", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "RSA-OAEP-256" });
      const data = encryptAes({ data: "test", kryptos });
      const encoded = createEncodedAesString(data);

      const buffer = require("@lindorm/b64").B64.toBuffer(encoded, "b64u");
      const headerLength = buffer.readUInt16BE(0);
      const cekLength = buffer.readUInt16BE(2 + headerLength);

      expect(cekLength).toBeGreaterThan(0);
    });

    test("A128KW mode should have non-zero CEK length", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
      const data = encryptAes({ data: "test", kryptos });
      const encoded = createEncodedAesString(data);

      const buffer = require("@lindorm/b64").B64.toBuffer(encoded, "b64u");
      const headerLength = buffer.readUInt16BE(0);
      const cekLength = buffer.readUInt16BE(2 + headerLength);

      expect(cekLength).toBeGreaterThan(0);
    });
  });
});
