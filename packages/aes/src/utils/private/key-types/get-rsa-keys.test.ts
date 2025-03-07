import { KryptosKit } from "@lindorm/kryptos";
import { getRsaDecryptionKey, getRsaEncryptionKey } from "./get-rsa-keys";

describe("get-rsa-keys", () => {
  test("should return encryption keys with RSA-OAEP", () => {
    const kryptos = KryptosKit.make.enc.rsa({ algorithm: "RSA-OAEP" });

    const result = getRsaEncryptionKey({
      encryption: "A128GCM",
      kryptos,
    });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
    });

    expect(
      getRsaDecryptionKey({
        encryption: "A128GCM",
        publicEncryptionKey: result.publicEncryptionKey,
        kryptos,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });

  test("should return encryption keys with RSA-OAEP-256", () => {
    const kryptos = KryptosKit.make.enc.rsa({ algorithm: "RSA-OAEP-256" });

    const result = getRsaEncryptionKey({
      encryption: "A128GCM",
      kryptos,
    });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
    });

    expect(
      getRsaDecryptionKey({
        encryption: "A128GCM",
        publicEncryptionKey: result.publicEncryptionKey,
        kryptos,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });

  test("should return encryption keys with RSA-OAEP-384", () => {
    const kryptos = KryptosKit.make.enc.rsa({ algorithm: "RSA-OAEP-384" });

    const result = getRsaEncryptionKey({
      encryption: "A128GCM",
      kryptos,
    });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
    });

    expect(
      getRsaDecryptionKey({
        encryption: "A128GCM",
        publicEncryptionKey: result.publicEncryptionKey,
        kryptos,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });

  test("should return encryption keys with RSA-OAEP-512", () => {
    const kryptos = KryptosKit.make.enc.rsa({ algorithm: "RSA-OAEP-512" });

    const result = getRsaEncryptionKey({
      encryption: "A128GCM",
      kryptos,
    });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
    });

    expect(
      getRsaDecryptionKey({
        encryption: "A128GCM",
        publicEncryptionKey: result.publicEncryptionKey,
        kryptos,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });
});
