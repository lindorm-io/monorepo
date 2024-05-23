import { Kryptos } from "@lindorm/kryptos";
import { getRsaDecryptionKey, getRsaEncryptionKey } from "./get-rsa-keys";

describe("get-rsa-keys", () => {
  test("should return encryption keys with RSA-OAEP", () => {
    const kryptos = Kryptos.generate({
      algorithm: "RSA-OAEP",
      type: "RSA",
      use: "enc",
    });

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
    const kryptos = Kryptos.generate({
      algorithm: "RSA-OAEP-256",
      type: "RSA",
      use: "enc",
    });

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
    const kryptos = Kryptos.generate({
      algorithm: "RSA-OAEP-384",
      type: "RSA",
      use: "enc",
    });

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
    const kryptos = Kryptos.generate({
      algorithm: "RSA-OAEP-512",
      type: "RSA",
      use: "enc",
    });

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
