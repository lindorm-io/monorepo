import { Kryptos } from "@lindorm/kryptos";
import { _getRsaDecryptionKey, _getRsaEncryptionKey } from "./get-rsa-keys";

describe("get-rsa-keys", () => {
  test("should return encryption keys with RSA-OAEP", () => {
    const kryptos = Kryptos.generate({
      algorithm: "RSA-OAEP",
      type: "RSA",
      use: "enc",
    });

    const result = _getRsaEncryptionKey({
      encryption: "aes-128-gcm",
      kryptos,
    });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
    });

    expect(
      _getRsaDecryptionKey({
        publicEncryptionKey: result.publicEncryptionKey,
        kryptos,
      }),
    ).toEqual(result.contentEncryptionKey);
  });

  test("should return encryption keys with RSA-OAEP-256", () => {
    const kryptos = Kryptos.generate({
      algorithm: "RSA-OAEP-256",
      type: "RSA",
      use: "enc",
    });

    const result = _getRsaEncryptionKey({
      encryption: "aes-128-gcm",
      kryptos,
    });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
    });

    expect(
      _getRsaDecryptionKey({
        publicEncryptionKey: result.publicEncryptionKey,
        kryptos,
      }),
    ).toEqual(result.contentEncryptionKey);
  });

  test("should return encryption keys with RSA-OAEP-384", () => {
    const kryptos = Kryptos.generate({
      algorithm: "RSA-OAEP-384",
      type: "RSA",
      use: "enc",
    });

    const result = _getRsaEncryptionKey({
      encryption: "aes-128-gcm",
      kryptos,
    });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
    });

    expect(
      _getRsaDecryptionKey({
        publicEncryptionKey: result.publicEncryptionKey,
        kryptos,
      }),
    ).toEqual(result.contentEncryptionKey);
  });

  test("should return encryption keys with RSA-OAEP-512", () => {
    const kryptos = Kryptos.generate({
      algorithm: "RSA-OAEP-512",
      type: "RSA",
      use: "enc",
    });

    const result = _getRsaEncryptionKey({
      encryption: "aes-128-gcm",
      kryptos,
    });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
    });

    expect(
      _getRsaDecryptionKey({
        publicEncryptionKey: result.publicEncryptionKey,
        kryptos,
      }),
    ).toEqual(result.contentEncryptionKey);
  });
});
