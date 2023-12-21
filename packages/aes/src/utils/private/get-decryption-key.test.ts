import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { PUBLIC_RSA_KEY } from "../../fixtures/rsa-keys.fixture";
import { getDecryptionKey } from "./get-decryption-key";

import { getRsaDecryptionKey as _getRsaDecryptionKey } from "./rsa";
import { getSecretDecryptionKey as _getSecretDecryptionKey } from "./secret";

jest.mock("./rsa");
jest.mock("./secret");

const getRsaDecryptionKey = _getRsaDecryptionKey as jest.Mock;
const getSecretDecryptionKey = _getSecretDecryptionKey as jest.Mock;

describe("getDecryptionKey", () => {
  beforeEach(() => {
    getRsaDecryptionKey.mockReturnValue("getRsaDecryptionKey");
    getSecretDecryptionKey.mockReturnValue("getSecretDecryptionKey");
  });

  afterEach(jest.clearAllMocks);

  test("should resolve decryption key with secret", () => {
    expect(
      getDecryptionKey({
        algorithm: AesAlgorithm.AES_256_GCM,
        secret: "secret",
      }),
    ).toStrictEqual("getSecretDecryptionKey");

    expect(getSecretDecryptionKey).toHaveBeenCalled();
  });

  test("should resolve decryption key with key", () => {
    expect(
      getDecryptionKey({
        algorithm: AesAlgorithm.AES_256_GCM,
        key: PUBLIC_RSA_KEY,
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_256,
        publicEncryptionKey: Buffer.from("public-encryption-key"),
      }),
    ).toStrictEqual("getRsaDecryptionKey");

    expect(getRsaDecryptionKey).toHaveBeenCalled();
  });

  test("should throw error with both key and secret", () => {
    expect(() =>
      getDecryptionKey({
        algorithm: AesAlgorithm.AES_256_GCM,
        key: PUBLIC_RSA_KEY,
        secret: "secret",
      }),
    ).toThrow(AesError);
  });

  test("should throw when key is missing", () => {
    expect(() =>
      getDecryptionKey({
        algorithm: AesAlgorithm.AES_256_GCM,
      }),
    ).toThrow(AesError);
  });

  test("should throw when encryption key algorithm is missing", () => {
    expect(() =>
      getDecryptionKey({
        algorithm: AesAlgorithm.AES_256_GCM,
        key: PUBLIC_RSA_KEY,
      }),
    ).toThrow(AesError);
  });

  test("should throw when public encryption key is missing", () => {
    expect(() =>
      getDecryptionKey({
        algorithm: AesAlgorithm.AES_256_GCM,
        key: PUBLIC_RSA_KEY,
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_256,
      }),
    ).toThrow(AesError);
  });
});
