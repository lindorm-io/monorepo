import {
  TEST_EC_KEY,
  TEST_OCT_KEY,
  TEST_OKP_KEY,
  TEST_RSA_KEY,
} from "../../../__fixtures__/keys";
import { _getEcEncryptionKey } from "../key-types/get-ec-keys";
import { _getOctEncryptionKey } from "../key-types/get-oct-keys";
import { _getOkpEncryptionKey } from "../key-types/get-okp-keys";
import { _getRsaEncryptionKey } from "../key-types/get-rsa-keys";
import { _getEncryptionKey } from "./get-encryption-key";

jest.mock("../key-types/get-ec-keys");
jest.mock("../key-types/get-oct-keys");
jest.mock("../key-types/get-okp-keys");
jest.mock("../key-types/get-rsa-keys");

const getEcEncryptionKey = _getEcEncryptionKey as jest.Mock;
const getOctEncryptionKey = _getOctEncryptionKey as jest.Mock;
const getOkpEncryptionKey = _getOkpEncryptionKey as jest.Mock;
const getRsaEncryptionKey = _getRsaEncryptionKey as jest.Mock;

describe("getEncryptionKeys", () => {
  beforeEach(() => {
    getEcEncryptionKey.mockReturnValue("getEcEncryptionKey");
    getOctEncryptionKey.mockReturnValue("getOctEncryptionKey");
    getOkpEncryptionKey.mockReturnValue("getOkpEncryptionKey");
    getRsaEncryptionKey.mockReturnValue("getRsaEncryptionKey");
  });

  afterEach(jest.clearAllMocks);

  test("should resolve encryption keys with EC key", () => {
    expect(
      _getEncryptionKey({
        encryption: "aes-256-gcm",
        kryptos: TEST_EC_KEY,
      }),
    ).toBe("getEcEncryptionKey");
  });

  test("should resolve encryption keys with OCT key", () => {
    expect(
      _getEncryptionKey({
        encryption: "aes-256-gcm",
        kryptos: TEST_OCT_KEY,
      }),
    ).toBe("getOctEncryptionKey");
  });

  test("should resolve encryption keys with OKP key", () => {
    expect(
      _getEncryptionKey({
        encryption: "aes-256-gcm",
        kryptos: TEST_OKP_KEY,
      }),
    ).toBe("getOkpEncryptionKey");
  });

  test("should resolve encryption keys with RSA key", () => {
    expect(
      _getEncryptionKey({
        encryption: "aes-256-gcm",
        kryptos: TEST_RSA_KEY,
      }),
    ).toBe("getRsaEncryptionKey");
  });
});
