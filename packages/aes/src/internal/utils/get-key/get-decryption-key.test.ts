import { getEcDecryptionKey as _getEcDecryptionKey } from "#internal/utils/key-types/get-ec-keys";
import { getOctDecryptionKey as _getOctDecryptionKey } from "#internal/utils/key-types/get-oct-keys";
import { getOkpDecryptionKey as _getOkpDecryptionKey } from "#internal/utils/key-types/get-okp-keys";
import { getRsaDecryptionKey as _getRsaDecryptionKey } from "#internal/utils/key-types/get-rsa-keys";
import {
  TEST_EC_KEY,
  TEST_OCT_KEY,
  TEST_OKP_KEY,
  TEST_RSA_KEY,
} from "../../../__fixtures__/keys";
import { getDecryptionKey } from "./get-decryption-key";

jest.mock("#internal/utils/key-types/get-ec-keys");
jest.mock("#internal/utils/key-types/get-oct-keys");
jest.mock("#internal/utils/key-types/get-okp-keys");
jest.mock("#internal/utils/key-types/get-rsa-keys");

const getEcDecryptionKey = _getEcDecryptionKey as jest.Mock;
const getOctDecryptionKey = _getOctDecryptionKey as jest.Mock;
const getOkpDecryptionKey = _getOkpDecryptionKey as jest.Mock;
const getRsaDecryptionKey = _getRsaDecryptionKey as jest.Mock;

describe("getDecryptionKey", () => {
  beforeEach(() => {
    getEcDecryptionKey.mockReturnValue("getEcDecryptionKey");
    getOctDecryptionKey.mockReturnValue("getOctDecryptionKey");
    getOkpDecryptionKey.mockReturnValue("getOkpDecryptionKey");
    getRsaDecryptionKey.mockReturnValue("getRsaDecryptionKey");
  });

  afterEach(jest.clearAllMocks);

  test("should resolve decryption key with EC key", () => {
    expect(
      getDecryptionKey({
        encryption: "A256GCM",
        kryptos: TEST_EC_KEY,
        publicEncryptionJwk: { crv: "P-521", x: "x", y: "y", kty: "EC" },
      }),
    ).toEqual("getEcDecryptionKey");
  });

  test("should resolve decryption key with OCT key", () => {
    expect(
      getDecryptionKey({
        encryption: "A256GCM",
        kryptos: TEST_OCT_KEY,
      }),
    ).toEqual("getOctDecryptionKey");
  });

  test("should resolve decryption key with OKP key", () => {
    expect(
      getDecryptionKey({
        encryption: "A256GCM",
        kryptos: TEST_OKP_KEY,
        publicEncryptionJwk: { crv: "P-521", x: "x", y: "y", kty: "EC" },
      }),
    ).toEqual("getOkpDecryptionKey");
  });

  test("should resolve decryption key with RSA key", () => {
    expect(
      getDecryptionKey({
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("public-encryption-key"),
        kryptos: TEST_RSA_KEY,
      }),
    ).toEqual("getRsaDecryptionKey");
  });
});
