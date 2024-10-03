import { isAesTokenised } from "./is-aes";
import { createTokenisedAesString, parseTokenisedAesString } from "./tokenised-aes";

describe("tokenised-aes", () => {
  test("should resolve string", () => {
    const string = createTokenisedAesString({
      algorithm: "RSA-OAEP-256",
      authTag: Buffer.from("authTag"),
      content: Buffer.from("encryption"),
      encryption: "A256GCM",
      hkdfSalt: Buffer.from("hkdfSalt"),
      initialisationVector: Buffer.from("initialisationVector"),
      keyId: "2e36ee7d-8423-59ad-a3f4-379e6b487c64",
      pbkdfIterations: 1000,
      pbkdfSalt: Buffer.from("pbkdfSalt"),
      publicEncryptionIv: Buffer.from("publicEncryptionIv"),
      publicEncryptionKey: Buffer.from("publicEncryptionKey"),
      publicEncryptionTag: Buffer.from("publicEncryptionTag"),
      version: 1,
      publicEncryptionJwk: {
        crv: "P-521",
        x: "Af3ZdH3XBQFqC4qISUyAPW9WrCDe36KuTFcLz0dIhoh8LeCk4PGt2HEs9pQyxlEVS9fm1tecb9Wk+83nUNBLDet7",
        y: "ATdzYQHx4ZS1DJYb27bRy+NouEm53Jmpdk0Z00B1PIZcRwBEoYVPUQAmYsEt18MX1nLDdwKXV2dONaytvbkdRIMH",
        kty: "EC",
      },
    });

    expect(string).toContain("$A256GCM$");

    expect(string).toContain("v=1");
    expect(string).toContain("alg=RSA-OAEP-256");
    expect(string).toContain("crv=P-521");
    expect(string).toContain("hks=aGtkZlNhbHQ");
    expect(string).toContain("iv=aW5pdGlhbGlzYXRpb25WZWN0b3I");
    expect(string).toContain("kid=2e36ee7d-8423-59ad-a3f4-379e6b487c64");
    expect(string).toContain("p2c=1000");
    expect(string).toContain("p2s=cGJrZGZTYWx0");
    expect(string).toContain("pei=cHVibGljRW5jcnlwdGlvbkl2");
    expect(string).toContain("pek=cHVibGljRW5jcnlwdGlvbktleQ");
    expect(string).toContain("pet=cHVibGljRW5jcnlwdGlvblRhZw");
    expect(string).toContain("tag=YXV0aFRhZw");
    expect(string).toContain(
      "x=Af3ZdH3XBQFqC4qISUyAPW9WrCDe36KuTFcLz0dIhoh8LeCk4PGt2HEs9pQyxlEVS9fm1tecb9Wk+83nUNBLDet7",
    );
    expect(string).toContain(
      "y=ATdzYQHx4ZS1DJYb27bRy+NouEm53Jmpdk0Z00B1PIZcRwBEoYVPUQAmYsEt18MX1nLDdwKXV2dONaytvbkdRIMH",
    );

    expect(string).toContain("$ZW5jcnlwdGlvbg$");

    expect(isAesTokenised(string)).toEqual(true);
  });

  test("should resolve decoded data", () => {
    expect(
      parseTokenisedAesString(
        "$A256GCM$v=1,f=base64url,kid=2e36ee7d-8423-59ad-a3f4-379e6b487c64,alg=RSA-OAEP-256,iv=aW5pdGlhbGlzYXRpb25WZWN0b3I,tag=YXV0aFRhZw,hks=aGtkZlNhbHQ,p2c=1000,p2s=cGJrZGZTYWx0,pei=cHVibGljRW5jcnlwdGlvbkl2,pek=cHVibGljRW5jcnlwdGlvbktleQ,pet=cHVibGljRW5jcnlwdGlvblRhZw,crv=P-521,kty=EC,x=Af3ZdH3XBQFqC4qISUyAPW9WrCDe36KuTFcLz0dIhoh8LeCk4PGt2HEs9pQyxlEVS9fm1tecb9Wk+83nUNBLDet7,y=ATdzYQHx4ZS1DJYb27bRy+NouEm53Jmpdk0Z00B1PIZcRwBEoYVPUQAmYsEt18MX1nLDdwKXV2dONaytvbkdRIMH$ZW5jcnlwdGlvbg$",
      ),
    ).toEqual({
      authTag: Buffer.from("authTag"),
      content: Buffer.from("encryption"),
      encryption: "A256GCM",
      algorithm: "RSA-OAEP-256",
      hkdfSalt: Buffer.from("hkdfSalt"),
      initialisationVector: Buffer.from("initialisationVector"),
      keyId: "2e36ee7d-8423-59ad-a3f4-379e6b487c64",
      publicEncryptionJwk: {
        crv: "P-521",
        x: "Af3ZdH3XBQFqC4qISUyAPW9WrCDe36KuTFcLz0dIhoh8LeCk4PGt2HEs9pQyxlEVS9fm1tecb9Wk+83nUNBLDet7",
        y: "ATdzYQHx4ZS1DJYb27bRy+NouEm53Jmpdk0Z00B1PIZcRwBEoYVPUQAmYsEt18MX1nLDdwKXV2dONaytvbkdRIMH",
        kty: "EC",
      },
      pbkdfIterations: 1000,
      pbkdfSalt: Buffer.from("pbkdfSalt"),
      publicEncryptionIv: Buffer.from("publicEncryptionIv"),
      publicEncryptionKey: Buffer.from("publicEncryptionKey"),
      publicEncryptionTag: Buffer.from("publicEncryptionTag"),
      version: 1,
    });
  });
});
