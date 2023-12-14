import { decodeAesString } from "./decode-aes-string";

describe("decodeAesString", () => {
  test("should resolve decoded data", () => {
    expect(
      decodeAesString(
        "$aes-256-gcm$v=1,f=b64,iv=aW5pdGlhbGlzYXRpb25WZWN0b3I=,tag=YXV0aFRhZw==,cea=rsa-oaep,cek=cHVibGljRW5jcnlwdGlvbktleQ==$ZW5jcnlwdGlvbg==$",
      ),
    ).toStrictEqual({
      algorithm: "aes-256-gcm",
      authTag: Buffer.from("authTag"),
      encryption: Buffer.from("encryption"),
      format: "base64",
      initialisationVector: Buffer.from("initialisationVector"),
      publicEncryptionKey: Buffer.from("publicEncryptionKey"),
      version: 1,
    });
  });
});
