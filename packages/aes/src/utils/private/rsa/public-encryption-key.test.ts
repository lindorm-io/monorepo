import { TEST_RSA_KEY } from "../../../__fixtures__/keys";
import {
  _createPublicEncryptionKey,
  _decryptPublicEncryptionKey,
} from "./public-encryption-key";

describe("public-encryption-key", () => {
  const encryptionKey = Buffer.from("encryption-key");

  test("should encrypt encryption key with RSA-OAEP", () => {
    const kryptos = TEST_RSA_KEY.clone({ algorithm: "RSA-OAEP" });

    const publicEncryptionKey = _createPublicEncryptionKey({
      encryptionKey,
      kryptos,
    });

    expect(publicEncryptionKey).toEqual(expect.any(Buffer));

    const decrypted = _decryptPublicEncryptionKey({
      publicEncryptionKey,
      kryptos,
    });

    expect(decrypted).toEqual(expect.any(Buffer));
    expect(decrypted).toEqual(encryptionKey);
  });

  test("should encrypt encryption key with RSA-OAEP-256", () => {
    const kryptos = TEST_RSA_KEY.clone({ algorithm: "RSA-OAEP-256" });

    const publicEncryptionKey = _createPublicEncryptionKey({
      encryptionKey,
      kryptos,
    });

    expect(publicEncryptionKey).toEqual(expect.any(Buffer));

    const decrypted = _decryptPublicEncryptionKey({
      publicEncryptionKey,
      kryptos,
    });

    expect(decrypted).toEqual(expect.any(Buffer));
    expect(decrypted).toEqual(encryptionKey);
  });

  test("should encrypt encryption key with RSA-OAEP-384", () => {
    const kryptos = TEST_RSA_KEY.clone({ algorithm: "RSA-OAEP-384" });

    const publicEncryptionKey = _createPublicEncryptionKey({
      encryptionKey,
      kryptos,
    });

    expect(publicEncryptionKey).toEqual(expect.any(Buffer));

    const decrypted = _decryptPublicEncryptionKey({
      publicEncryptionKey,
      kryptos,
    });

    expect(decrypted).toEqual(expect.any(Buffer));
    expect(decrypted).toEqual(encryptionKey);
  });

  test("should encrypt encryption key with RSA-OAEP-512", () => {
    const kryptos = TEST_RSA_KEY.clone({ algorithm: "RSA-OAEP-512" });

    const publicEncryptionKey = _createPublicEncryptionKey({
      encryptionKey,
      kryptos,
    });

    expect(publicEncryptionKey).toEqual(expect.any(Buffer));

    const decrypted = _decryptPublicEncryptionKey({
      publicEncryptionKey,
      kryptos,
    });

    expect(decrypted).toEqual(expect.any(Buffer));
    expect(decrypted).toEqual(encryptionKey);
  });
});
