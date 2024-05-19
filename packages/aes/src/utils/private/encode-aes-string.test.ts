import { _encodeAesString } from "./encode-aes-string";

describe("encodeAesString", () => {
  test("should resolve string", () => {
    const string = _encodeAesString({
      authTag: Buffer.from("authTag"),
      content: Buffer.from("encryption"),
      encryption: "aes-256-gcm",
      encryptionKeyAlgorithm: "RSA-OAEP-256",
      format: "base64url",
      hkdfSalt: Buffer.from("hkdfSalt"),
      initialisationVector: Buffer.from("initialisationVector"),
      integrityHash: "SHA256",
      keyId: Buffer.from("keyId"),
      publicEncryptionJwk: {
        crv: "P-521",
        x: "Af3ZdH3XBQFqC4qISUyAPW9WrCDe36KuTFcLz0dIhoh8LeCk4PGt2HEs9pQyxlEVS9fm1tecb9Wk+83nUNBLDet7",
        y: "ATdzYQHx4ZS1DJYb27bRy+NouEm53Jmpdk0Z00B1PIZcRwBEoYVPUQAmYsEt18MX1nLDdwKXV2dONaytvbkdRIMH",
        kty: "EC",
      },
      pbkdfIterations: 1000,
      pbkdfSalt: Buffer.from("pbkdfSalt"),
      publicEncryptionKey: Buffer.from("publicEncryptionKey"),
      version: 1,
    });

    expect(string).toContain("$aes-256-gcm$");

    expect(string).toContain("v=1");
    expect(string).toContain("f=base64");

    expect(string).toContain("crv=P-521");
    expect(string).toContain("eka=RSA-OAEP-256");
    expect(string).toContain("hks=aGtkZlNhbHQ");
    expect(string).toContain("ih=SHA256");
    expect(string).toContain("iv=aW5pdGlhbGlzYXRpb25WZWN0b3I");
    expect(string).toContain("kid=a2V5SWQ");
    expect(string).toContain("p2c=1000");
    expect(string).toContain("p2s=cGJrZGZTYWx0");
    expect(string).toContain("pek=cHVibGljRW5jcnlwdGlvbktleQ");
    expect(string).toContain("tag=YXV0aFRhZw");
    expect(string).toContain(
      "x=Af3ZdH3XBQFqC4qISUyAPW9WrCDe36KuTFcLz0dIhoh8LeCk4PGt2HEs9pQyxlEVS9fm1tecb9Wk+83nUNBLDet7",
    );
    expect(string).toContain(
      "y=ATdzYQHx4ZS1DJYb27bRy+NouEm53Jmpdk0Z00B1PIZcRwBEoYVPUQAmYsEt18MX1nLDdwKXV2dONaytvbkdRIMH",
    );

    expect(string).toContain("$ZW5jcnlwdGlvbg$");
  });
});
