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
  });
});
