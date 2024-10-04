import { Kryptos, KryptosEncAlgorithm } from "@lindorm/kryptos";
import { createEncodedAesString, parseEncodedAesString } from "./encoded-aes";
import { encryptAes } from "./encryption";

describe("encoded-aes", () => {
  test("should consistently resolve string", () => {
    expect(
      createEncodedAesString({
        algorithm: "PBES2-HS512+A256KW",
        authTag: Buffer.from("jscAu1QymW2pXRGksYrFvA==", "base64url"),
        content: Buffer.from("mpTW97o=", "base64url"),
        encryption: "A256GCM",
        hkdfSalt: undefined,
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
      }),
    ).toEqual(
      "ATgkYzAzYjU4OWItMTI0ZC00NWViLTgzNzYtZDdmMDU3NjgxMWZmElBCRVMyLUhTNTEyK0EyNTZLVwdBMjU2R0NNEI7HALtUMpltqV0RpLGKxbwM2R3KWgWuSS-u8_tmAAAASAABAAF21wEQqauzF1XQGmbtwtoIpVEFYQAAAQAAACih0D1-FgGCWx-9GuryEuwKzkVosB6n1yTq6rMFk4ApvZmrCUpKGFI_AJqU1ve6",
    );
  });

  test("should consistently resolve record", () => {
    expect(
      parseEncodedAesString(
        "ATgkYzAzYjU4OWItMTI0ZC00NWViLTgzNzYtZDdmMDU3NjgxMWZmElBCRVMyLUhTNTEyK0EyNTZLVwdBMjU2R0NNEI7HALtUMpltqV0RpLGKxbwM2R3KWgWuSS-u8_tmAAAASAABAAF21wEQqauzF1XQGmbtwtoIpVEFYQAAAQAAACih0D1-FgGCWx-9GuryEuwKzkVosB6n1yTq6rMFk4ApvZmrCUpKGFI_AJqU1ve6",
      ),
    ).toEqual({
      algorithm: "PBES2-HS512+A256KW",
      authTag: Buffer.from("jscAu1QymW2pXRGksYrFvA==", "base64url"),
      content: Buffer.from("mpTW97o=", "base64url"),
      encryption: "A256GCM",
      hkdfSalt: undefined,
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
      const kryptos = Kryptos.auto({ algorithm });
      const data = encryptAes({ data: "test", kryptos });
      const encoded = createEncodedAesString(data);
      const decoded = parseEncodedAesString(encoded);

      expect(encoded).toEqual(expect.any(String));
      expect(decoded).toEqual(data);
    });
  });
});
