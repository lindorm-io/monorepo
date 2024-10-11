import {
  TEST_EC_KEY,
  TEST_OCT_KEY,
  TEST_OKP_KEY,
  TEST_RSA_KEY,
} from "../../../__fixtures__/keys";
import {
  getEcEncryptionKey as _getEcEncryptionKey,
  getOctEncryptionKey as _getOctEncryptionKey,
  getOkpEncryptionKey as _getOkpEncryptionKey,
  getRsaEncryptionKey as _getRsaEncryptionKey,
} from "../key-types";
import { getEncryptionKey } from "./get-encryption-key";

jest.mock("../key-types");

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
      getEncryptionKey({
        encryption: "A256GCM",
        kryptos: TEST_EC_KEY,
      }),
    ).toEqual("getEcEncryptionKey");
  });

  test("should resolve encryption keys with OCT key", () => {
    expect(
      getEncryptionKey({
        encryption: "A256GCM",
        kryptos: TEST_OCT_KEY,
      }),
    ).toEqual("getOctEncryptionKey");
  });

  test("should resolve encryption keys with OKP key", () => {
    expect(
      getEncryptionKey({
        encryption: "A256GCM",
        kryptos: TEST_OKP_KEY,
      }),
    ).toEqual("getOkpEncryptionKey");
  });

  test("should resolve encryption keys with RSA key", () => {
    expect(
      getEncryptionKey({
        encryption: "A256GCM",
        kryptos: TEST_RSA_KEY,
      }),
    ).toEqual("getRsaEncryptionKey");
  });
});
