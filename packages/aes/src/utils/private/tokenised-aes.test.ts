import { B64 } from "@lindorm/b64";
import { KryptosEncAlgorithm, KryptosKit } from "@lindorm/kryptos";
import { isAesTokenised } from "../is-aes";
import { encryptAes } from "./encryption";
import { createTokenisedAesString, parseTokenisedAesString } from "./tokenised-aes";

describe("tokenised-aes", () => {
  test("should create a tokenised string with CEK (key-wrap mode)", () => {
    const string = createTokenisedAesString({
      algorithm: "RSA-OAEP-256",
      authTag: Buffer.from("authTag"),
      content: Buffer.from("encryption"),
      contentType: "text/plain",
      encryption: "A256GCM",
      initialisationVector: Buffer.from("initialisationVector"),
      keyId: "2e36ee7d-8423-59ad-a3f4-379e6b487c64",
      pbkdfIterations: 1000,
      pbkdfSalt: Buffer.from("pbkdfSalt"),
      publicEncryptionIv: undefined,
      publicEncryptionJwk: {
        crv: "P-521",
        x: "Af3ZdH3XBQFqC4qISUyAPW9WrCDe36KuTFcLz0dIhoh8LeCk4PGt2HEs9pQyxlEVS9fm1tecb9Wk+83nUNBLDet7",
        y: "ATdzYQHx4ZS1DJYb27bRy+NouEm53Jmpdk0Z00B1PIZcRwBEoYVPUQAmYsEt18MX1nLDdwKXV2dONaytvbkdRIMH",
        kty: "EC",
      },
      publicEncryptionKey: Buffer.from("publicEncryptionKey"),
      publicEncryptionTag: undefined,
      version: "1.0",
    });

    expect(string).toMatch(/^aes:/);
    expect(string.split("$")).toHaveLength(5); // header$cek$iv$tag$ciphertext
    expect(isAesTokenised(string)).toBe(true);
  });

  test("should create a tokenised string without CEK (dir mode)", () => {
    const string = createTokenisedAesString({
      algorithm: "dir",
      authTag: Buffer.from("authTag"),
      content: Buffer.from("encryption"),
      contentType: "text/plain",
      encryption: "A256GCM",
      initialisationVector: Buffer.from("initialisationVector"),
      keyId: "2e36ee7d-8423-59ad-a3f4-379e6b487c64",
      pbkdfIterations: undefined,
      pbkdfSalt: undefined,
      publicEncryptionIv: undefined,
      publicEncryptionJwk: undefined,
      publicEncryptionKey: undefined,
      publicEncryptionTag: undefined,
      version: "1.0",
    });

    expect(string).toMatch(/^aes:/);
    expect(string.split("$")).toHaveLength(4); // header$iv$tag$ciphertext
    expect(isAesTokenised(string)).toBe(true);
  });

  test("should round-trip create and parse with CEK", () => {
    const original = {
      algorithm: "RSA-OAEP-256" as const,
      authTag: Buffer.from("authTag"),
      content: Buffer.from("encryption"),
      contentType: "text/plain" as const,
      encryption: "A256GCM" as const,
      initialisationVector: Buffer.from("initialisationVector"),
      keyId: "2e36ee7d-8423-59ad-a3f4-379e6b487c64",
      pbkdfIterations: 1000,
      pbkdfSalt: Buffer.from("pbkdfSalt"),
      publicEncryptionIv: undefined,
      publicEncryptionJwk: {
        crv: "P-521" as const,
        x: "Af3ZdH3XBQFqC4qISUyAPW9WrCDe36KuTFcLz0dIhoh8LeCk4PGt2HEs9pQyxlEVS9fm1tecb9Wk+83nUNBLDet7",
        y: "ATdzYQHx4ZS1DJYb27bRy+NouEm53Jmpdk0Z00B1PIZcRwBEoYVPUQAmYsEt18MX1nLDdwKXV2dONaytvbkdRIMH",
        kty: "EC" as const,
      },
      publicEncryptionKey: Buffer.from("publicEncryptionKey"),
      publicEncryptionTag: undefined,
      version: "1.0",
    };

    const string = createTokenisedAesString(original);
    const parsed = parseTokenisedAesString(string);

    expect(parsed.algorithm).toBe(original.algorithm);
    expect(parsed.authTag).toEqual(original.authTag);
    expect(parsed.content).toEqual(original.content);
    expect(parsed.contentType).toBe(original.contentType);
    expect(parsed.encryption).toBe(original.encryption);
    expect(parsed.initialisationVector).toEqual(original.initialisationVector);
    expect(parsed.keyId).toBe(original.keyId);
    expect(parsed.pbkdfIterations).toBe(original.pbkdfIterations);
    expect(parsed.pbkdfSalt).toEqual(original.pbkdfSalt);
    expect(parsed.publicEncryptionJwk).toEqual(original.publicEncryptionJwk);
    expect(parsed.publicEncryptionKey).toEqual(original.publicEncryptionKey);
    expect(parsed.version).toBe(original.version);
    expect(parsed.aad).toBeInstanceOf(Buffer);
  });

  test("should round-trip create and parse without CEK (dir)", () => {
    const original = {
      algorithm: "dir" as const,
      authTag: Buffer.from("authTag"),
      content: Buffer.from("encryption"),
      contentType: "text/plain" as const,
      encryption: "A256GCM" as const,
      initialisationVector: Buffer.from("initialisationVector"),
      keyId: "2e36ee7d-8423-59ad-a3f4-379e6b487c64",
      pbkdfIterations: undefined,
      pbkdfSalt: undefined,
      publicEncryptionIv: undefined,
      publicEncryptionJwk: undefined,
      publicEncryptionKey: undefined,
      publicEncryptionTag: undefined,
      version: "1.0",
    };

    const string = createTokenisedAesString(original);
    const parsed = parseTokenisedAesString(string);

    expect(parsed.algorithm).toBe(original.algorithm);
    expect(parsed.authTag).toEqual(original.authTag);
    expect(parsed.content).toEqual(original.content);
    expect(parsed.encryption).toBe(original.encryption);
    expect(parsed.publicEncryptionKey).toBeUndefined();
    expect(parsed.aad).toBeInstanceOf(Buffer);
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

    test.each(algorithms)(
      "should create and parse tokenised string for %s",
      (algorithm) => {
        const kryptos = KryptosKit.generate.auto({ algorithm });
        const data = encryptAes({ data: "test", kryptos });
        const string = createTokenisedAesString(data);
        const parsed = parseTokenisedAesString(string);

        expect(string).toMatch(/^aes:/);
        expect(parsed.algorithm).toBe(data.algorithm);
        expect(parsed.encryption).toBe(data.encryption);
        expect(parsed.content).toEqual(data.content);
        expect(parsed.aad).toBeInstanceOf(Buffer);
      },
    );
  });

  describe("error handling", () => {
    test("should throw for string not starting with 'aes:'", () => {
      expect(() => parseTokenisedAesString("invalid")).toThrow(
        "Invalid tokenised AES string: must start with 'aes:'",
      );
    });

    test("should throw for wrong number of segments", () => {
      expect(() => parseTokenisedAesString("aes:a$b")).toThrow(
        "unexpected number of segments",
      );
    });

    test("should throw for truncated tokenised string (missing segments)", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
      const data = encryptAes({ data: "test", kryptos });
      const tokenised = createTokenisedAesString(data);

      // Remove the last segment
      const parts = tokenised.split("$");
      parts.pop();
      const truncated = parts.join("$");

      // Should throw either for unexpected segment count or missing CEK
      expect(() => parseTokenisedAesString(truncated)).toThrow();
    });

    test("should throw for invalid base64url in header segment", () => {
      expect(() => parseTokenisedAesString("aes:!!!invalid!!!$a$b$c")).toThrow();
    });

    test("should throw for missing required header fields (no enc)", () => {
      const invalidHeader = { alg: "dir", v: "1.0", kid: "test" };
      const headerB64 = B64.encode(
        Buffer.from(JSON.stringify(invalidHeader), "utf8"),
        "b64u",
      );
      const invalidTokenised = `aes:${headerB64}$aaa$bbb$ccc`;

      expect(() => parseTokenisedAesString(invalidTokenised)).toThrow(
        "missing required fields",
      );
    });

    test("should throw for missing required header fields (no alg)", () => {
      const invalidHeader = { enc: "A256GCM", v: "1.0", kid: "test" };
      const headerB64 = B64.encode(
        Buffer.from(JSON.stringify(invalidHeader), "utf8"),
        "b64u",
      );
      const invalidTokenised = `aes:${headerB64}$aaa$bbb$ccc`;

      expect(() => parseTokenisedAesString(invalidTokenised)).toThrow(
        "missing required fields",
      );
    });

    test("should throw for future version rejection (v: 2.0)", () => {
      const futureHeader = { alg: "dir", enc: "A256GCM", v: "2.0", kid: "test" };
      const headerB64 = B64.encode(
        Buffer.from(JSON.stringify(futureHeader), "utf8"),
        "b64u",
      );
      const futureTokenised = `aes:${headerB64}$aaa$bbb$ccc`;

      expect(() => parseTokenisedAesString(futureTokenised)).toThrow(
        "Incompatible AES version",
      );
    });

    test("should throw for legacy version rejection (v: 11 as integer string)", () => {
      const legacyHeader = { alg: "dir", enc: "A256GCM", v: "11", kid: "test" };
      const headerB64 = B64.encode(
        Buffer.from(JSON.stringify(legacyHeader), "utf8"),
        "b64u",
      );
      const legacyTokenised = `aes:${headerB64}$aaa$bbb$ccc`;

      expect(() => parseTokenisedAesString(legacyTokenised)).toThrow(
        "Legacy AES version format is no longer supported",
      );
    });

    test("should throw for dir mode with CEK segment (wrong segment count)", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "A256GCM",
      });
      const data = encryptAes({ data: "test", kryptos });
      const tokenised = createTokenisedAesString(data);

      // Inject an extra segment to simulate CEK presence
      const parts = tokenised.split("$");
      const modified = `${parts[0]}$extra$${parts.slice(1).join("$")}`;

      expect(() => parseTokenisedAesString(modified)).toThrow(
        "dir/ECDH-ES must not have CEK segment",
      );
    });

    test("should throw for ECDH-ES mode with CEK segment", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "ECDH-ES" });
      const data = encryptAes({ data: "test", kryptos });
      const tokenised = createTokenisedAesString(data);

      // Inject an extra segment
      const parts = tokenised.split("$");
      const modified = `${parts[0]}$extra$${parts.slice(1).join("$")}`;

      expect(() => parseTokenisedAesString(modified)).toThrow(
        "dir/ECDH-ES must not have CEK segment",
      );
    });

    test("should throw for non-dir algorithm without CEK segment", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
      const data = encryptAes({ data: "test", kryptos });
      const tokenised = createTokenisedAesString(data);

      // Remove the CEK segment (second segment after header)
      const parts = tokenised.split("$");
      const [header, , ...rest] = parts;
      const modified = `${header}$${rest.join("$")}`;

      expect(() => parseTokenisedAesString(modified)).toThrow(
        "non-dir algorithm must have CEK segment",
      );
    });
  });

  describe("tamper-detection tests (CRITICAL)", () => {
    describe("GCM mode", () => {
      test("should fail decryption when header field is modified", () => {
        const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
        const data = encryptAes({ data: "test", kryptos });
        const tokenised = createTokenisedAesString(data);

        // Parse and modify the header (without "aes:" prefix)
        const withoutPrefix = tokenised.slice(4);
        const parts = withoutPrefix.split("$");
        const headerB64 = parts[0];
        const originalAad = Buffer.from(headerB64, "ascii");
        const headerJson = B64.toBuffer(headerB64, "b64u").toString("utf8");
        const header = JSON.parse(headerJson);

        // Tamper with algorithm
        header.alg = "A256KW";
        const tamperedHeaderJson = JSON.stringify(header);
        const tamperedHeaderB64 = B64.encode(
          Buffer.from(tamperedHeaderJson, "utf8"),
          "b64u",
        );

        parts[0] = tamperedHeaderB64;
        const tampered = `aes:${parts.join("$")}`;

        expect(() => parseTokenisedAesString(tampered)).not.toThrow();
        const parsed = parseTokenisedAesString(tampered);

        // AAD has changed, so decryption should fail
        expect(parsed.aad).not.toEqual(originalAad);
      });

      test("should fail decryption when ciphertext segment is modified", () => {
        const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
        const data = encryptAes({ data: "test", kryptos });
        const tokenised = createTokenisedAesString(data);

        const withoutPrefix = tokenised.slice(4);
        const parts = withoutPrefix.split("$");
        const ciphertextB64 = parts[parts.length - 1];

        // Modify a byte in the ciphertext
        const ciphertext = B64.toBuffer(ciphertextB64, "b64u");
        ciphertext[0] ^= 0xff;
        const tamperedCiphertextB64 = B64.encode(ciphertext, "b64u");

        parts[parts.length - 1] = tamperedCiphertextB64;
        const tampered = `aes:${parts.join("$")}`;

        // Should parse, but content is corrupted
        const parsed = parseTokenisedAesString(tampered);
        expect(parsed.content).not.toEqual(data.content);
      });

      test("should fail decryption when tag segment is modified", () => {
        const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
        const data = encryptAes({ data: "test", kryptos });
        const tokenised = createTokenisedAesString(data);

        const withoutPrefix = tokenised.slice(4);
        const parts = withoutPrefix.split("$");
        const tagIndex = parts.length - 2; // Tag is second-to-last
        const tagB64 = parts[tagIndex];

        // Modify a byte in the tag
        const tag = B64.toBuffer(tagB64, "b64u");
        tag[0] ^= 0xff;
        const tamperedTagB64 = B64.encode(tag, "b64u");

        parts[tagIndex] = tamperedTagB64;
        const tampered = `aes:${parts.join("$")}`;

        // Should parse, but auth tag is corrupted
        const parsed = parseTokenisedAesString(tampered);
        expect(parsed.authTag).not.toEqual(data.authTag);
      });
    });

    describe("CBC-HMAC mode", () => {
      test("should fail decryption when header is modified (A128CBC-HS256)", () => {
        const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
        const data = encryptAes({ data: "test", kryptos, encryption: "A128CBC-HS256" });
        const tokenised = createTokenisedAesString(data);

        const withoutPrefix = tokenised.slice(4);
        const parts = withoutPrefix.split("$");
        const headerB64 = parts[0];
        const originalAad = Buffer.from(headerB64, "ascii");
        const headerJson = B64.toBuffer(headerB64, "b64u").toString("utf8");
        const header = JSON.parse(headerJson);

        // Tamper with encryption
        header.enc = "A256CBC-HS512";
        const tamperedHeaderB64 = B64.encode(
          Buffer.from(JSON.stringify(header), "utf8"),
          "b64u",
        );

        parts[0] = tamperedHeaderB64;
        const tampered = `aes:${parts.join("$")}`;

        const parsed = parseTokenisedAesString(tampered);

        // AAD has changed
        expect(parsed.aad).not.toEqual(originalAad);
      });

      test("should fail decryption when ciphertext is modified (A256CBC-HS512)", () => {
        const kryptos = KryptosKit.generate.auto({ algorithm: "A256KW" });
        const data = encryptAes({ data: "test", kryptos, encryption: "A256CBC-HS512" });
        const tokenised = createTokenisedAesString(data);

        const withoutPrefix = tokenised.slice(4);
        const parts = withoutPrefix.split("$");
        const ciphertextB64 = parts[parts.length - 1];

        const ciphertext = B64.toBuffer(ciphertextB64, "b64u");
        ciphertext[ciphertext.length - 1] ^= 0x01;
        const tamperedCiphertextB64 = B64.encode(ciphertext, "b64u");

        parts[parts.length - 1] = tamperedCiphertextB64;
        const tampered = `aes:${parts.join("$")}`;

        const parsed = parseTokenisedAesString(tampered);
        expect(parsed.content).not.toEqual(data.content);
      });
    });
  });

  describe("AAD round-trip tests", () => {
    test("should have non-empty AAD after parsing", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
      const data = encryptAes({ data: "test", kryptos });
      const tokenised = createTokenisedAesString(data);

      const parsed = parseTokenisedAesString(tokenised);

      expect(parsed.aad).toBeInstanceOf(Buffer);
      expect(parsed.aad.length).toBeGreaterThan(0);
    });

    test("should have AAD matching header segment", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
      const data = encryptAes({ data: "test", kryptos });
      const tokenised = createTokenisedAesString(data);

      // Remove "aes:" prefix to get header segment
      const withoutPrefix = tokenised.slice(4);
      const parts = withoutPrefix.split("$");
      const headerB64 = parts[0];
      const expectedAad = Buffer.from(headerB64, "ascii");

      const parsed = parseTokenisedAesString(tokenised);

      expect(parsed.aad).toEqual(expectedAad);
    });

    test("should compute same AAD for encrypt and parse", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
      const data = encryptAes({ data: "test", kryptos });
      const tokenised = createTokenisedAesString(data);

      const parsed = parseTokenisedAesString(tokenised);

      // The AAD should be derivable from the header (without "aes:" prefix)
      const withoutPrefix = tokenised.slice(4);
      const parts = withoutPrefix.split("$");
      const headerB64 = parts[0];
      const computedAad = Buffer.from(headerB64, "ascii");

      expect(parsed.aad).toEqual(computedAad);
    });
  });

  describe("variable segment tests", () => {
    test("dir mode should produce 4 segments (no CEK)", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "A256GCM",
      });
      const data = encryptAes({ data: "test", kryptos });
      const tokenised = createTokenisedAesString(data);

      expect(tokenised.split("$")).toHaveLength(4);
    });

    test("ECDH-ES mode should produce 4 segments (no CEK)", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "ECDH-ES" });
      const data = encryptAes({ data: "test", kryptos });
      const tokenised = createTokenisedAesString(data);

      expect(tokenised.split("$")).toHaveLength(4);
    });

    test("RSA-OAEP mode should produce 5 segments (with CEK)", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "RSA-OAEP-256" });
      const data = encryptAes({ data: "test", kryptos });
      const tokenised = createTokenisedAesString(data);

      expect(tokenised.split("$")).toHaveLength(5);
    });

    test("A128KW mode should produce 5 segments (with CEK)", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "A128KW" });
      const data = encryptAes({ data: "test", kryptos });
      const tokenised = createTokenisedAesString(data);

      expect(tokenised.split("$")).toHaveLength(5);
    });

    test("PBES2-HS256+A128KW mode should produce 5 segments (with CEK)", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "PBES2-HS256+A128KW" });
      const data = encryptAes({ data: "test", kryptos });
      const tokenised = createTokenisedAesString(data);

      expect(tokenised.split("$")).toHaveLength(5);
    });

    test("ECDH-ES+A256KW mode should produce 5 segments (with CEK)", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "ECDH-ES+A256KW" });
      const data = encryptAes({ data: "test", kryptos });
      const tokenised = createTokenisedAesString(data);

      expect(tokenised.split("$")).toHaveLength(5);
    });
  });
});
