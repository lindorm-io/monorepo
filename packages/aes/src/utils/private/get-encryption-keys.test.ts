import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { SYMMETRIC_OCT_PEM } from "../../fixtures/oct-keys.fixture";
import { PUBLIC_RSA_PEM } from "../../fixtures/rsa-keys.fixture";
import { getEncryptionKeys } from "./get-encryption-keys";

import { getOctEncryptionKeys as _getOctEncryptionKeys } from "./oct";
import { getRsaEncryptionKeys as _getRsaEncryptionKeys } from "./rsa";
import { getSecretEncryptionKeys as _getSecretEncryptionKeys } from "./secret";

jest.mock("./oct");
jest.mock("./rsa");
jest.mock("./secret");

const getOctEncryptionKeys = _getOctEncryptionKeys as jest.Mock;
const getRsaEncryptionKeys = _getRsaEncryptionKeys as jest.Mock;
const getSecretEncryptionKeys = _getSecretEncryptionKeys as jest.Mock;

describe("getEncryptionKeys", () => {
  beforeEach(() => {
    getOctEncryptionKeys.mockReturnValue("getOctEncryptionKeys");
    getRsaEncryptionKeys.mockReturnValue("getRsaEncryptionKeys");
    getSecretEncryptionKeys.mockReturnValue("getSecretEncryptionKeys");
  });

  afterEach(jest.clearAllMocks);

  test("should resolve encryption keys with secret", () => {
    expect(
      getEncryptionKeys({
        algorithm: AesAlgorithm.AES_256_GCM,
        secret: "secret",
      }),
    ).toBe("getSecretEncryptionKeys");

    expect(getSecretEncryptionKeys).toHaveBeenCalled();
  });

  test("should resolve encryption keys with RSA key", () => {
    expect(
      getEncryptionKeys({
        algorithm: AesAlgorithm.AES_256_GCM,
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_256,
        key: PUBLIC_RSA_PEM,
      }),
    ).toBe("getRsaEncryptionKeys");

    expect(getRsaEncryptionKeys).toHaveBeenCalled();
  });

  test("should resolve encryption keys with OCT key", () => {
    expect(
      getEncryptionKeys({
        algorithm: AesAlgorithm.AES_256_GCM,
        key: SYMMETRIC_OCT_PEM,
      }),
    ).toBe("getOctEncryptionKeys");

    expect(getOctEncryptionKeys).toHaveBeenCalled();
  });

  test("should throw error with both key and secret", () => {
    expect(() =>
      getEncryptionKeys({
        algorithm: AesAlgorithm.AES_256_GCM,
        key: PUBLIC_RSA_PEM,
        secret: "secret",
      }),
    ).toThrow(AesError);
  });

  test("should throw when key is missing", () => {
    expect(() =>
      getEncryptionKeys({
        algorithm: AesAlgorithm.AES_256_GCM,
      }),
    ).toThrow(AesError);
  });
});
