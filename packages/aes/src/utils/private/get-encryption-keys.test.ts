import { EC_KEY_SET } from "../../fixtures/ec-keys.fixture";
import { OCT_KEY_SET } from "../../fixtures/oct-keys.fixture";
import { RSA_KEY_SET } from "../../fixtures/rsa-keys.fixture";
import { getEcEncryptionKeys as _getEcEncryptionKeys } from "./ec";
import { getEncryptionKeys } from "./get-encryption-keys";
import { getOctEncryptionKeys as _getOctEncryptionKeys } from "./oct";
import { getRsaEncryptionKeys as _getRsaEncryptionKeys } from "./rsa";

jest.mock("./ec");
jest.mock("./oct");
jest.mock("./rsa");

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
      getEncryptionKeys({
        encryption: "aes-256-gcm",
        encryptionKeyAlgorithm: "ECDH-ES",
        keySet: EC_KEY_SET,
      }),
    ).toBe("getEcEncryptionKeys");

    expect(getEcEncryptionKeys).toHaveBeenCalled();
  });

  test("should resolve encryption keys with RSA key", () => {
    expect(
      getEncryptionKeys({
        encryption: "aes-256-gcm",
        encryptionKeyAlgorithm: "RSA-OAEP-256",
        keySet: RSA_KEY_SET,
      }),
    ).toBe("getRsaEncryptionKeys");

    expect(getRsaEncryptionKeys).toHaveBeenCalled();
  });

  test("should resolve encryption keys with OCT key", () => {
    expect(
      getEncryptionKeys({
        encryption: "aes-256-gcm",
        keySet: OCT_KEY_SET,
      }),
    ).toBe("getOctEncryptionKeys");

    expect(getOctEncryptionKeys).toHaveBeenCalled();
  });
});
