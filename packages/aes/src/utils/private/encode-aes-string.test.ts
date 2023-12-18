import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "../../enums";
import { encodeAesString } from "./encode-aes-string";

describe("encodeAesString", () => {
  test("should resolve string", () => {
    const string = encodeAesString({
      algorithm: AesAlgorithm.AES_256_GCM,
      authTag: Buffer.from("authTag"),
      content: Buffer.from("encryption"),
      format: "base64",
      initialisationVector: Buffer.from("initialisationVector"),
      encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_256,
      keyId: Buffer.from("keyId"),
      publicEncryptionKey: Buffer.from("publicEncryptionKey"),
      version: 1,
    });

    expect(string).toContain("$aes-256-gcm$");
    expect(string).toContain("v=1");
    expect(string).toContain("f=b64");
    expect(string).toContain("eka=rsa-oaep-256");
    expect(string).toContain("cek=cHVibGljRW5jcnlwdGlvbktleQ==");
    expect(string).toContain("iv=aW5pdGlhbGlzYXRpb25WZWN0b3I=");
    expect(string).toContain("kid=a2V5SWQ=");
    expect(string).toContain("tag=YXV0aFRhZw==");
    expect(string).toContain("$ZW5jcnlwdGlvbg==$");
  });
});
