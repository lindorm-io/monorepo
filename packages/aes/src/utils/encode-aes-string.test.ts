import { encodeAesString } from "./encode-aes-string";

describe("encodeAesString", () => {
  test("should resolve string", () => {
    const string = encodeAesString({
      algorithm: "aes-256-gcm",
      authTag: Buffer.from("authTag"),
      encryption: Buffer.from("encryption"),
      format: "base64",
      initialisationVector: Buffer.from("initialisationVector"),
      publicEncryptionKey: Buffer.from("publicEncryptionKey"),
      version: 1,
    });

    expect(string).toContain("$aes-256-gcm$");
    expect(string).toContain("v=1");
    expect(string).toContain("f=base64");
    expect(string).toContain("cek=cHVibGljRW5jcnlwdGlvbktleQ==");
    expect(string).toContain("$aW5pdGlhbGlzYXRpb25WZWN0b3I=$");
    expect(string).toContain("$ZW5jcnlwdGlvbg==$");
    expect(string).toContain("$YXV0aFRhZw==$");
  });
});
