import { _decodeAesString } from "./decode-aes-string";

describe("decodeAesString", () => {
  test("should resolve decoded data", () => {
    expect(
      _decodeAesString(
        "$A256GCM$v=1,f=base64url,alg=RSA-OAEP-256,iv=aW5pdGlhbGlzYXRpb25WZWN0b3I,kid=a2V5SWQ,tag=YXV0aFRhZw,hks=aGtkZlNhbHQ,p2c=1000,p2s=cGJrZGZTYWx0,pek=cHVibGljRW5jcnlwdGlvbktleQ,crv=P-521,kty=EC,x=Af3ZdH3XBQFqC4qISUyAPW9WrCDe36KuTFcLz0dIhoh8LeCk4PGt2HEs9pQyxlEVS9fm1tecb9Wk+83nUNBLDet7,y=ATdzYQHx4ZS1DJYb27bRy+NouEm53Jmpdk0Z00B1PIZcRwBEoYVPUQAmYsEt18MX1nLDdwKXV2dONaytvbkdRIMH$ZW5jcnlwdGlvbg$",
      ),
    ).toEqual({
      authTag: Buffer.from("authTag"),
      content: Buffer.from("encryption"),
      encryption: "A256GCM",
      algorithm: "RSA-OAEP-256",
      format: "base64url",
      hkdfSalt: Buffer.from("hkdfSalt"),
      initialisationVector: Buffer.from("initialisationVector"),
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
  });
});
