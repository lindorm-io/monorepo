import { AesEncryptionKeyAlgorithm, AesFormat } from "../../enums";
import { decodeAesString } from "./decode-aes-string";

describe("decodeAesString", () => {
  test("should resolve decoded data", () => {
    expect(
      decodeAesString(
        "$aes-256-gcm$v=1,f=base64,cek=cHVibGljRW5jcnlwdGlvbktleQ==,eka=rsa-oaep,iv=aW5pdGlhbGlzYXRpb25WZWN0b3I=,kid=a2V5SWQ=,tag=YXV0aFRhZw==$ZW5jcnlwdGlvbg==$",
      ),
    ).toStrictEqual({
      algorithm: "aes-256-gcm",
      authTag: Buffer.from("authTag"),
      content: Buffer.from("encryption"),
      encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP,
      format: AesFormat.BASE64,
      initialisationVector: Buffer.from("initialisationVector"),
      keyId: Buffer.from("keyId"),
      publicEncryptionKey: Buffer.from("publicEncryptionKey"),
      version: 1,
    });
  });
});
