import {
  TEST_EC_KEY,
  TEST_OCT_KEY,
  TEST_OKP_KEY,
  TEST_RSA_KEY,
} from "../../__fixtures__/keys";
import { _getDiffieHellmanEncryptionKey } from "./encryption-keys/shared-secret";
import { _getEncryptionKeys } from "./get-encryption-keys";
import { _getOctEncryptionKeys } from "./oct/get-oct-keys";
import { _getRsaEncryptionKeys } from "./rsa/get-rsa-keys";

jest.mock("./encryption-keys/shared-secret");
jest.mock("./oct/get-oct-keys");
jest.mock("./rsa/get-rsa-keys");

const getDiffieHellmanEncryptionKey = _getDiffieHellmanEncryptionKey as jest.Mock;
const getOctEncryptionKeys = _getOctEncryptionKeys as jest.Mock;
const getRsaEncryptionKeys = _getRsaEncryptionKeys as jest.Mock;

describe("getEncryptionKeys", () => {
  beforeEach(() => {
    getDiffieHellmanEncryptionKey.mockReturnValue("getDiffieHellmanEncryptionKey");
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
    ).toBe("getDiffieHellmanEncryptionKey");

    expect(getDiffieHellmanEncryptionKey).toHaveBeenCalled();
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

  test("should resolve encryption keys with OKP key", () => {
    expect(
      _getEncryptionKeys({
        encryption: "aes-256-gcm",
        kryptos: TEST_OKP_KEY,
      }),
    ).toBe("getDiffieHellmanEncryptionKey");

    expect(getDiffieHellmanEncryptionKey).toHaveBeenCalled();
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
});
