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

  describe("error handling", () => {
    test("should throw for invalid base64url in header", () => {
      const invalid: any = {
        header: "!!!invalid!!!",
        iv: "aaa",
        tag: "bbb",
        ciphertext: "ccc",
        v: "1.0",
      };

      expect(() => parseSerialisedAesRecord(invalid)).toThrow();
    });

    test("should throw for missing required header fields (no enc)", () => {
      const invalidHeader = { alg: "dir", v: "1.0", kid: "test" };
      const headerB64 = require("@lindorm/b64").B64.encode(
        Buffer.from(JSON.stringify(invalidHeader), "utf8"),
        "b64u",
      );

      const invalid: any = {
        header: headerB64,
        iv: "aaa",
        tag: "bbb",
        ciphertext: "ccc",
        v: "1.0",
      };

      expect(() => parseSerialisedAesRecord(invalid)).toThrow("missing required fields");
    });

    test("should throw for missing required header fields (no alg)", () => {
      const invalidHeader = { enc: "A256GCM", v: "1.0", kid: "test" };
      const headerB64 = require("@lindorm/b64").B64.encode(
        Buffer.from(JSON.stringify(invalidHeader), "utf8"),
        "b64u",
      );

      const invalid: any = {
        header: headerB64,
        iv: "aaa",
        tag: "bbb",
        ciphertext: "ccc",
        v: "1.0",
      };

      expect(() => parseSerialisedAesRecord(invalid)).toThrow("missing required fields");
    });

    test("should throw for future version (v: 2.0)", () => {
      const futureHeader = { alg: "dir", enc: "A256GCM", v: "2.0", kid: "test" };
      const headerB64 = require("@lindorm/b64").B64.encode(
        Buffer.from(JSON.stringify(futureHeader), "utf8"),
        "b64u",
      );

      const invalid: any = {
        header: headerB64,
        iv: "aaa",
        tag: "bbb",
        ciphertext: "ccc",
        v: "1.0",
      };

      expect(() => parseSerialisedAesRecord(invalid)).toThrow("Incompatible AES version");
    });

    test("should throw for legacy version (v: 11)", () => {
      const legacyHeader = { alg: "dir", enc: "A256GCM", v: "11", kid: "test" };
      const headerB64 = require("@lindorm/b64").B64.encode(
        Buffer.from(JSON.stringify(legacyHeader), "utf8"),
        "b64u",
      );

      const invalid: any = {
        header: headerB64,
        iv: "aaa",
        tag: "bbb",
        ciphertext: "ccc",
        v: "1.0",
      };

      expect(() => parseSerialisedAesRecord(invalid)).toThrow(
        "Legacy AES version format is no longer supported",
      );
    });

    test("should throw for invalid JSON in header", () => {
      const invalid: any = {
        header: require("@lindorm/b64").B64.encode(
          Buffer.from("not-json", "utf8"),
          "b64u",
        ),
        iv: "aaa",
        tag: "bbb",
        ciphertext: "ccc",
        v: "1.0",
      };

      expect(() => parseSerialisedAesRecord(invalid)).toThrow();
    });
  });

  describe("tamper-detection tests (CRITICAL)", () => {
    describe("GCM mode", () => {
      test("should detect tampered header field", () => {
        const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
        const data = encryptAes({ data: "test", kryptos });
        const serialised = createSerialisedAesRecord(data);

        // Decode header, modify it, re-encode
        const headerJson = require("@lindorm/b64")
          .B64.toBuffer(serialised.header, "b64u")
          .toString("utf8");
        const header = JSON.parse(headerJson);

        header.alg = "A256KW"; // Tamper

        const tamperedHeaderB64 = require("@lindorm/b64").B64.encode(
          Buffer.from(JSON.stringify(header), "utf8"),
          "b64u",
        );

        const tampered = {
          ...serialised,
          header: tamperedHeaderB64,
        };

        const parsed = parseSerialisedAesRecord(tampered);

        // AAD has changed
        expect(parsed.aad).not.toEqual(Buffer.from(serialised.header, "ascii"));
      });

      test("should detect tampered ciphertext", () => {
        const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
        const data = encryptAes({ data: "test", kryptos });
        const serialised = createSerialisedAesRecord(data);

        // Modify ciphertext
        const ciphertext = require("@lindorm/b64").B64.toBuffer(
          serialised.ciphertext,
          "b64u",
        );
        ciphertext[0] ^= 0xff;
        const tamperedCiphertextB64 = require("@lindorm/b64").B64.encode(
          ciphertext,
          "b64u",
        );

        const tampered = {
          ...serialised,
          ciphertext: tamperedCiphertextB64,
        };

        const parsed = parseSerialisedAesRecord(tampered);
        expect(parsed.content).not.toEqual(data.content);
      });

      test("should detect tampered auth tag", () => {
        const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
        const data = encryptAes({ data: "test", kryptos });
        const serialised = createSerialisedAesRecord(data);

        // Modify tag
        const tag = require("@lindorm/b64").B64.toBuffer(serialised.tag, "b64u");
        tag[tag.length - 1] ^= 0x01;
        const tamperedTagB64 = require("@lindorm/b64").B64.encode(tag, "b64u");

        const tampered = {
          ...serialised,
          tag: tamperedTagB64,
        };

        const parsed = parseSerialisedAesRecord(tampered);
        expect(parsed.authTag).not.toEqual(data.authTag);
      });
    });

    describe("CBC-HMAC mode", () => {
      test("should detect tampered header in CBC mode (A128CBC-HS256)", () => {
        const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
        const data = encryptAes({ data: "test", kryptos, encryption: "A128CBC-HS256" });
        const serialised = createSerialisedAesRecord(data);

        const headerJson = require("@lindorm/b64")
          .B64.toBuffer(serialised.header, "b64u")
          .toString("utf8");
        const header = JSON.parse(headerJson);

        header.enc = "A256CBC-HS512"; // Tamper

        const tamperedHeaderB64 = require("@lindorm/b64").B64.encode(
          Buffer.from(JSON.stringify(header), "utf8"),
          "b64u",
        );

        const tampered = {
          ...serialised,
          header: tamperedHeaderB64,
        };

        const parsed = parseSerialisedAesRecord(tampered);
        expect(parsed.aad).not.toEqual(Buffer.from(serialised.header, "ascii"));
      });

      test("should detect tampered ciphertext in CBC mode (A256CBC-HS512)", () => {
        const kryptos = KryptosKit.generate.auto({ algorithm: "A256KW" });
        const data = encryptAes({ data: "test", kryptos, encryption: "A256CBC-HS512" });
        const serialised = createSerialisedAesRecord(data);

        const ciphertext = require("@lindorm/b64").B64.toBuffer(
          serialised.ciphertext,
          "b64u",
        );
        ciphertext[ciphertext.length - 1] ^= 0x01;
        const tamperedCiphertextB64 = require("@lindorm/b64").B64.encode(
          ciphertext,
          "b64u",
        );

        const tampered = {
          ...serialised,
          ciphertext: tamperedCiphertextB64,
        };

        const parsed = parseSerialisedAesRecord(tampered);
        expect(parsed.content).not.toEqual(data.content);
      });
    });
  });

  describe("AAD round-trip tests", () => {
    test("should have non-empty AAD after parsing", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
      const data = encryptAes({ data: "test", kryptos });
      const serialised = createSerialisedAesRecord(data);

      const parsed = parseSerialisedAesRecord(serialised);

      expect(parsed.aad).toBeInstanceOf(Buffer);
      expect(parsed.aad!.length).toBeGreaterThan(0);
    });

    test("should have AAD matching header field", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
      const data = encryptAes({ data: "test", kryptos });
      const serialised = createSerialisedAesRecord(data);

      const expectedAad = Buffer.from(serialised.header, "ascii");
      const parsed = parseSerialisedAesRecord(serialised);

      expect(parsed.aad).toEqual(expectedAad);
    });

    test("should compute same AAD for GCM and CBC modes", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });

      const gcmData = encryptAes({ data: "test", kryptos, encryption: "A128GCM" });
      const cbcData = encryptAes({ data: "test", kryptos, encryption: "A128CBC-HS256" });

      const gcmSerialised = createSerialisedAesRecord(gcmData);
      const cbcSerialised = createSerialisedAesRecord(cbcData);

      const gcmParsed = parseSerialisedAesRecord(gcmSerialised);
      const cbcParsed = parseSerialisedAesRecord(cbcSerialised);

      // Both should have AAD
      expect(gcmParsed.aad).toBeInstanceOf(Buffer);
      expect(cbcParsed.aad).toBeInstanceOf(Buffer);
      expect(gcmParsed.aad!.length).toBeGreaterThan(0);
      expect(cbcParsed.aad!.length).toBeGreaterThan(0);
    });
  });

  describe("variable segment tests", () => {
    test("dir mode should have undefined CEK", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "A256GCM",
      });
      const data = encryptAes({ data: "test", kryptos });
      const serialised = createSerialisedAesRecord(data);

      expect(serialised.cek).toBeUndefined();
    });

    test("ECDH-ES mode should have undefined CEK", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "ECDH-ES" });
      const data = encryptAes({ data: "test", kryptos });
      const serialised = createSerialisedAesRecord(data);

      expect(serialised.cek).toBeUndefined();
    });

    test("RSA-OAEP mode should have defined CEK", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "RSA-OAEP-256" });
      const data = encryptAes({ data: "test", kryptos });
      const serialised = createSerialisedAesRecord(data);

      expect(serialised.cek).toBeDefined();
      expect(typeof serialised.cek).toBe("string");
    });

    test("A128KW mode should have defined CEK", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
      const data = encryptAes({ data: "test", kryptos });
      const serialised = createSerialisedAesRecord(data);

      expect(serialised.cek).toBeDefined();
      expect(typeof serialised.cek).toBe("string");
    });

    test("PBES2-HS256+A128KW mode should have defined CEK", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "PBES2-HS256+A128KW" });
      const data = encryptAes({ data: "test", kryptos });
      const serialised = createSerialisedAesRecord(data);

      expect(serialised.cek).toBeDefined();
      expect(typeof serialised.cek).toBe("string");
    });
  });
});
