import { decodeAesString } from "./decode-aes-string";

describe("decodeAesString", () => {
  test("should resolve decoded data", () => {
    expect(
      decodeAesString(
        "$aes-256-gcm$v=1,f=b64,cek=cHVibGljRW5jcnlwdGlvbktleQ==,iv=aW5pdGlhbGlzYXRpb25WZWN0b3I=,kid=a2V5SWQ=,pka=rsa-oaep,tag=YXV0aFRhZw==$ZW5jcnlwdGlvbg==$",
      ),
    ).toStrictEqual({
      algorithm: "aes-256-gcm",
      authTag: Buffer.from("authTag"),
      encryption: Buffer.from("encryption"),
      format: "base64",
      initialisationVector: Buffer.from("initialisationVector"),
      keyId: Buffer.from("keyId"),
      publicEncryptionKey: Buffer.from("publicEncryptionKey"),
      version: 1,
    });
  });
});
