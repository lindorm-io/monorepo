import { EC_KEY_SET } from "../../__fixtures__/ec-keys.fixture";
import { OCT_KEY_SET } from "../../__fixtures__/oct-keys.fixture";
import { RSA_KEY_SET } from "../../__fixtures__/rsa-keys.fixture";
import { _getEcEncryptionKeys } from "./ec/get-ec-keys";
import { _getEncryptionKeys } from "./get-encryption-keys";
import { _getOctEncryptionKeys } from "./oct/get-oct-keys";
import { _getRsaEncryptionKeys } from "./rsa/get-rsa-keys";

jest.mock("./ec/get-ec-keys");
jest.mock("./oct/get-oct-keys");
jest.mock("./rsa/get-rsa-keys");

const getEcEncryptionKeys = _getEcEncryptionKeys as jest.Mock;
const getOctEncryptionKeys = _getOctEncryptionKeys as jest.Mock;
const getRsaEncryptionKeys = _getRsaEncryptionKeys as jest.Mock;

describe("getEncryptionKeys", () => {
  beforeEach(() => {
    getEcEncryptionKeys.mockReturnValue("getEcEncryptionKeys");
    getOctEncryptionKeys.mockReturnValue("getOctEncryptionKeys");
    getRsaEncryptionKeys.mockReturnValue("getRsaEncryptionKeys");
  });

  afterEach(jest.clearAllMocks);

  test("should resolve encryption keys with EC key", () => {
    expect(
      _getEncryptionKeys({
        encryption: "aes-256-gcm",
        encryptionKeyAlgorithm: "ECDH-ES",
        kryptos: EC_KEY_SET,
      }),
    ).toBe("getEcEncryptionKeys");

    expect(getEcEncryptionKeys).toHaveBeenCalled();
  });

  test("should resolve encryption keys with RSA key", () => {
    expect(
      _getEncryptionKeys({
        encryption: "aes-256-gcm",
        encryptionKeyAlgorithm: "RSA-OAEP-256",
        kryptos: RSA_KEY_SET,
      }),
    ).toBe("getRsaEncryptionKeys");

    expect(getRsaEncryptionKeys).toHaveBeenCalled();
  });

  test("should resolve encryption keys with OCT key", () => {
    expect(
      _getEncryptionKeys({
        encryption: "aes-256-gcm",
        kryptos: OCT_KEY_SET,
      }),
    ).toBe("getOctEncryptionKeys");

    expect(getOctEncryptionKeys).toHaveBeenCalled();
  });
});
