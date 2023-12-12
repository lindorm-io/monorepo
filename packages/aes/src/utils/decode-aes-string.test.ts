import { decodeAesString } from "./decode-aes-string";

describe("decodeAesString", () => {
  test("should resolve decoded data", () => {
    expect(
      decodeAesString(
        "$aes-256-gcm$v=1,f=base64,cek=cHVibGljRW5jcnlwdGlvbktleQ==$aW5pdGlhbGlzYXRpb25WZWN0b3I=$ZW5jcnlwdGlvbg==$YXV0aFRhZw==$",
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
