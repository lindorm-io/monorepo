import { KryptosEncAlgorithm, KryptosKit } from "@lindorm/kryptos";
import { createEncodedAesString, parseEncodedAesString } from "./encoded-aes";
import { encryptAes } from "./encryption";

describe("encoded-aes", () => {
  test("should consistently resolve string", () => {
    const encoded = createEncodedAesString({
      algorithm: "PBES2-HS512+A256KW",
      authTag: Buffer.from("jscAu1QymW2pXRGksYrFvA==", "base64url"),
      content: Buffer.from("mpTW97o=", "base64url"),
      contentType: "text/plain",
      encryption: "A256GCM",
      initialisationVector: Buffer.from("2R3KWgWuSS+u8/tm", "base64url"),
      keyId: "c03b589b-124d-45eb-8376-d7f0576811ff",
      pbkdfIterations: 95959,
      pbkdfSalt: Buffer.from("qauzF1XQGmbtwtoIpVEFYQ==", "base64url"),
      publicEncryptionIv: undefined,
      publicEncryptionJwk: undefined,
      publicEncryptionKey: Buffer.from(
        "odA9fhYBglsfvRrq8hLsCs5FaLAep9ck6uqzBZOAKb2ZqwlKShhSPw==",
        "base64url",
      ),
      publicEncryptionTag: undefined,
      version: 8,
    });

    expect(encoded).toEqual(expect.any(String));

    // Verify round-trip
    const decoded = parseEncodedAesString(encoded);
    expect(decoded.algorithm).toBe("PBES2-HS512+A256KW");
    expect(decoded.keyId).toBe("c03b589b-124d-45eb-8376-d7f0576811ff");
    expect(decoded.encryption).toBe("A256GCM");
    expect(decoded.pbkdfIterations).toBe(95959);
    expect(decoded.version).toBe(8);
  });

  test("should consistently resolve record via round-trip", () => {
    const original = {
      algorithm: "PBES2-HS512+A256KW" as const,
      authTag: Buffer.from("jscAu1QymW2pXRGksYrFvA==", "base64url"),
      content: Buffer.from("mpTW97o=", "base64url"),
      contentType: "text/plain" as const,
      encryption: "A256GCM" as const,
      initialisationVector: Buffer.from("2R3KWgWuSS+u8/tm", "base64url"),
      keyId: "c03b589b-124d-45eb-8376-d7f0576811ff",
      pbkdfIterations: 95959,
      pbkdfSalt: Buffer.from("qauzF1XQGmbtwtoIpVEFYQ==", "base64url"),
      publicEncryptionIv: undefined,
      publicEncryptionJwk: undefined,
      publicEncryptionKey: Buffer.from(
        "odA9fhYBglsfvRrq8hLsCs5FaLAep9ck6uqzBZOAKb2ZqwlKShhSPw==",
        "base64url",
      ),
      publicEncryptionTag: undefined,
      version: 8,
    };

    const encoded = createEncodedAesString(original);
    const decoded = parseEncodedAesString(encoded);

    expect(decoded).toEqual(original);
  });

  describe("algorithms", () => {
    const algorithms: Array<KryptosEncAlgorithm> = [
      // EC / OKP
      "ECDH-ES",
      "ECDH-ES+A128KW",
      "ECDH-ES+A192KW",
      "ECDH-ES+A256KW",
      "ECDH-ES+A128GCMKW",
      "ECDH-ES+A192GCMKW",
      "ECDH-ES+A256GCMKW",
      // oct
      "A128KW",
      "A192KW",
      "A256KW",
      "A128GCMKW",
      "A192GCMKW",
      "A256GCMKW",
      "PBES2-HS256+A128KW",
      "PBES2-HS384+A192KW",
      "PBES2-HS512+A256KW",
      // RSA
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
      expect(decoded).toEqual(data);
    });
  });
});
