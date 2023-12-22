import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { SYMMETRIC_OCT_PEM } from "../../fixtures/oct-keys.fixture";
import { PUBLIC_RSA_PEM } from "../../fixtures/rsa-keys.fixture";
import { getDecryptionKey } from "./get-decryption-key";

import { getOctDecryptionKey as _getOctDecryptionKey } from "./oct";
import { getRsaDecryptionKey as _getRsaDecryptionKey } from "./rsa";
import { getSecretDecryptionKey as _getSecretDecryptionKey } from "./secret";

jest.mock("./oct");
jest.mock("./rsa");
jest.mock("./secret");

const getOctDecryptionKey = _getOctDecryptionKey as jest.Mock;
const getRsaDecryptionKey = _getRsaDecryptionKey as jest.Mock;
const getSecretDecryptionKey = _getSecretDecryptionKey as jest.Mock;

describe("getDecryptionKey", () => {
  beforeEach(() => {
    getOctDecryptionKey.mockReturnValue("getOctDecryptionKey");
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

  test("should resolve decryption key with RSA key", () => {
    expect(
      getDecryptionKey({
        algorithm: AesAlgorithm.AES_256_GCM,
        key: PUBLIC_RSA_PEM,
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_256,
        publicEncryptionKey: Buffer.from("public-encryption-key"),
      }),
    ).toStrictEqual("getRsaDecryptionKey");

    expect(getRsaDecryptionKey).toHaveBeenCalled();
  });

  test("should resolve decryption key with OCT key", () => {
    expect(
      getDecryptionKey({
        algorithm: AesAlgorithm.AES_256_GCM,
        key: SYMMETRIC_OCT_PEM,
      }),
    ).toStrictEqual("getOctDecryptionKey");

    expect(getOctDecryptionKey).toHaveBeenCalled();
  });

  test("should throw error with both key and secret", () => {
    expect(() =>
      getDecryptionKey({
        algorithm: AesAlgorithm.AES_256_GCM,
        key: PUBLIC_RSA_PEM,
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
        key: PUBLIC_RSA_PEM,
      }),
    ).toThrow(AesError);
  });

  test("should throw when public encryption key is missing", () => {
    expect(() =>
      getDecryptionKey({
        algorithm: AesAlgorithm.AES_256_GCM,
        key: PUBLIC_RSA_PEM,
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_256,
      }),
    ).toThrow(AesError);
  });
});
