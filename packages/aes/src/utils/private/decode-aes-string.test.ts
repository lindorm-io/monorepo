import { _decodeAesString } from "./decode-aes-string";

describe("decodeAesString", () => {
  test("should resolve decoded data", () => {
    expect(
      _decodeAesString(
        "$aes-256-gcm$v=1,f=base64url,cek=cHVibGljRW5jcnlwdGlvbktleQ,crv=P-521,eka=RSA-OAEP-256,ih=sha256,iv=aW5pdGlhbGlzYXRpb25WZWN0b3I,kid=a2V5SWQ,kty=EC,tag=YXV0aFRhZw,x=Af3ZdH3XBQFqC4qISUyAPW9WrCDe36KuTFcLz0dIhoh8LeCk4PGt2HEs9pQyxlEVS9fm1tecb9Wk+83nUNBLDet7,y=ATdzYQHx4ZS1DJYb27bRy+NouEm53Jmpdk0Z00B1PIZcRwBEoYVPUQAmYsEt18MX1nLDdwKXV2dONaytvbkdRIMH$ZW5jcnlwdGlvbg$",
      ),
    ).toStrictEqual({
      encryption: "aes-256-gcm",
      authTag: Buffer.from("authTag"),
      content: Buffer.from("encryption"),
      encryptionKeyAlgorithm: "RSA-OAEP-256",
      format: "base64url",
      initialisationVector: Buffer.from("initialisationVector"),
      integrityHash: "sha256",
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
  });
});
