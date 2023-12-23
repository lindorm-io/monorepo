import { AesEncryptionKeyAlgorithm, AesFormat, AesIntegrityHash } from "../../enums";
import { decodeAesString } from "./decode-aes-string";

describe("decodeAesString", () => {
  test("should resolve decoded data", () => {
    expect(
      decodeAesString(
        "$aes-256-gcm$v=1,f=base64url,cek=cHVibGljRW5jcnlwdGlvbktleQ,crv=P-521,eka=rsa-oaep-256,ih=sha256,iv=aW5pdGlhbGlzYXRpb25WZWN0b3I,kid=a2V5SWQ,tag=YXV0aFRhZw,x=Af3ZdH3XBQFqC4qISUyAPW9WrCDe36KuTFcLz0dIhoh8LeCk4PGt2HEs9pQyxlEVS9fm1tecb9Wk+83nUNBLDet7,y=ATdzYQHx4ZS1DJYb27bRy+NouEm53Jmpdk0Z00B1PIZcRwBEoYVPUQAmYsEt18MX1nLDdwKXV2dONaytvbkdRIMH$ZW5jcnlwdGlvbg$",
      ),
    ).toStrictEqual({
      algorithm: "aes-256-gcm",
      authTag: Buffer.from("authTag"),
      content: Buffer.from("encryption"),
      encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_256,
      format: AesFormat.BASE64_URL,
      initialisationVector: Buffer.from("initialisationVector"),
      integrityHash: AesIntegrityHash.SHA256,
      keyId: Buffer.from("keyId"),
      publicEncryptionJwk: {
        crv: "P-521",
        x: "Af3ZdH3XBQFqC4qISUyAPW9WrCDe36KuTFcLz0dIhoh8LeCk4PGt2HEs9pQyxlEVS9fm1tecb9Wk+83nUNBLDet7",
        y: "ATdzYQHx4ZS1DJYb27bRy+NouEm53Jmpdk0Z00B1PIZcRwBEoYVPUQAmYsEt18MX1nLDdwKXV2dONaytvbkdRIMH",
      },
      publicEncryptionKey: Buffer.from("publicEncryptionKey"),
      version: 1,
    });
  });
});
