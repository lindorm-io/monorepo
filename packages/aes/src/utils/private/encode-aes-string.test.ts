import { AesAlgorithm, AesEncryptionKeyAlgorithm, AesFormat, AesIntegrityHash } from "../../enums";
import { encodeAesString } from "./encode-aes-string";

describe("encodeAesString", () => {
  test("should resolve string", () => {
    const string = encodeAesString({
      algorithm: AesAlgorithm.AES_256_GCM,
      authTag: Buffer.from("authTag"),
      content: Buffer.from("encryption"),
      format: AesFormat.BASE64_URL,
      integrityHash: AesIntegrityHash.SHA256,
      initialisationVector: Buffer.from("initialisationVector"),
      encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_256,
      keyId: Buffer.from("keyId"),
      publicEncryptionJwk: {
        crv: "P-521",
        x: "Af3ZdH3XBQFqC4qISUyAPW9WrCDe36KuTFcLz0dIhoh8LeCk4PGt2HEs9pQyxlEVS9fm1tecb9Wk+83nUNBLDet7",
        y: "ATdzYQHx4ZS1DJYb27bRy+NouEm53Jmpdk0Z00B1PIZcRwBEoYVPUQAmYsEt18MX1nLDdwKXV2dONaytvbkdRIMH",
      },
      publicEncryptionKey: Buffer.from("publicEncryptionKey"),
      version: 1,
    });

    expect(string).toContain("$aes-256-gcm$");

    expect(string).toContain("v=1");
    expect(string).toContain("f=base64");

    expect(string).toContain("cek=cHVibGljRW5jcnlwdGlvbktleQ");
    expect(string).toContain("crv=P-521");
    expect(string).toContain("eka=rsa-oaep-256");
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
