import { TEST_EC_KEY, TEST_OCT_KEY, TEST_RSA_KEY } from "../../__fixtures__/keys";
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
        kryptos: TEST_EC_KEY,
      }),
    ).toBe("getEcEncryptionKeys");

    expect(getEcEncryptionKeys).toHaveBeenCalled();
  });

  test("should resolve encryption keys with RSA key", () => {
    expect(
      _getEncryptionKeys({
        encryption: "aes-256-gcm",
        kryptos: TEST_RSA_KEY,
      }),
    ).toBe("getRsaEncryptionKeys");

    expect(getRsaEncryptionKeys).toHaveBeenCalled();
  });

  test("should resolve encryption keys with OCT key", () => {
    expect(
      _getEncryptionKeys({
        encryption: "aes-256-gcm",
        kryptos: TEST_OCT_KEY,
      }),
    ).toBe("getOctEncryptionKeys");

    expect(getOctEncryptionKeys).toHaveBeenCalled();
  });
});
