import { _encodeAesString } from "./encode-aes-string";

describe("encodeAesString", () => {
  test("should resolve string", () => {
    const string = _encodeAesString({
      encryption: "aes-256-gcm",
      authTag: Buffer.from("authTag"),
      content: Buffer.from("encryption"),
      format: "base64url",
      integrityHash: "sha256",
      initialisationVector: Buffer.from("initialisationVector"),
      encryptionKeyAlgorithm: "RSA-OAEP-256",
      keyId: Buffer.from("keyId"),
      publicEncryptionJwk: {
        crv: "P-521",
        x: "Af3ZdH3XBQFqC4qISUyAPW9WrCDe36KuTFcLz0dIhoh8LeCk4PGt2HEs9pQyxlEVS9fm1tecb9Wk+83nUNBLDet7",
        y: "ATdzYQHx4ZS1DJYb27bRy+NouEm53Jmpdk0Z00B1PIZcRwBEoYVPUQAmYsEt18MX1nLDdwKXV2dONaytvbkdRIMH",
        kty: "EC",
      },
      publicEncryptionKey: Buffer.from("publicEncryptionKey"),
      version: 1,
    });

    expect(string).toContain("$aes-256-gcm$");

    expect(string).toContain("v=1");
    expect(string).toContain("f=base64");

    expect(string).toContain("cek=cHVibGljRW5jcnlwdGlvbktleQ");
    expect(string).toContain("crv=P-521");
    expect(string).toContain("eka=RSA-OAEP-256");
    expect(string).toContain("ih=sha256");
    expect(string).toContain("iv=aW5pdGlhbGlzYXRpb25WZWN0b3I");
    expect(string).toContain("kid=a2V5SWQ");
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
