import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { PUBLIC_RSA_KEY } from "../../fixtures/rsa-keys.fixture";
import { getEncryptionKeys } from "./get-encryption-keys";

import { getRsaEncryptionKeys as _getRsaEncryptionKeys } from "./rsa";
import { getSecretEncryptionKeys as _getSecretEncryptionKeys } from "./secret";

jest.mock("./rsa");
jest.mock("./secret");

const getRsaEncryptionKeys = _getRsaEncryptionKeys as jest.Mock;
const getSecretEncryptionKeys = _getSecretEncryptionKeys as jest.Mock;

describe("getEncryptionKeys", () => {
  beforeEach(() => {
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

  test("should resolve encryption keys with key", () => {
    expect(
      getEncryptionKeys({
        algorithm: AesAlgorithm.AES_256_GCM,
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_256,
        key: PUBLIC_RSA_KEY,
      }),
    ).toBe("getRsaEncryptionKeys");

    expect(getRsaEncryptionKeys).toHaveBeenCalled();
  });

  test("should throw error with both key and secret", () => {
    expect(() =>
      getEncryptionKeys({
        algorithm: AesAlgorithm.AES_256_GCM,
        key: PUBLIC_RSA_KEY,
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
