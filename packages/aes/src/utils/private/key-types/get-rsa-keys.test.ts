import { TEST_RSA_KEY } from "../../../__fixtures__/keys";
import { _getRsaDecryptionKey, _getRsaEncryptionKey } from "./get-rsa-keys";

describe("get-rsa-keys", () => {
  test("should return encryption keys with RSA-OAEP", () => {
    const kryptos = TEST_RSA_KEY.clone({ algorithm: "RSA-OAEP" });

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
    const kryptos = TEST_RSA_KEY.clone({ algorithm: "RSA-OAEP-256" });

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
    const kryptos = TEST_RSA_KEY.clone({ algorithm: "RSA-OAEP-384" });

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
    const kryptos = TEST_RSA_KEY.clone({ algorithm: "RSA-OAEP-512" });

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
