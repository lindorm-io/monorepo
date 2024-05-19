import { _encodeAesString } from "./encode-aes-string";

describe("encodeAesString", () => {
  test("should resolve string", () => {
    const string = _encodeAesString({
      algorithm: "RSA-OAEP-256",
      authTag: Buffer.from("authTag"),
      content: Buffer.from("encryption"),
      encryption: "A256GCM",
      format: "base64url",
      hkdfSalt: Buffer.from("hkdfSalt"),
      initialisationVector: Buffer.from("initialisationVector"),
      keyId: Buffer.from("keyId"),
      pbkdfIterations: 1000,
      pbkdfSalt: Buffer.from("pbkdfSalt"),
      publicEncryptionKey: Buffer.from("publicEncryptionKey"),
      version: 1,
      publicEncryptionJwk: {
        crv: "P-521",
        x: "Af3ZdH3XBQFqC4qISUyAPW9WrCDe36KuTFcLz0dIhoh8LeCk4PGt2HEs9pQyxlEVS9fm1tecb9Wk+83nUNBLDet7",
        y: "ATdzYQHx4ZS1DJYb27bRy+NouEm53Jmpdk0Z00B1PIZcRwBEoYVPUQAmYsEt18MX1nLDdwKXV2dONaytvbkdRIMH",
        kty: "EC",
      },
    });

    expect(string).toContain("$A256GCM$");

    expect(string).toContain("v=1");
    expect(string).toContain("f=base64");

    expect(string).toContain("alg=RSA-OAEP-256");
    expect(string).toContain("crv=P-521");
    expect(string).toContain("hks=aGtkZlNhbHQ");
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
