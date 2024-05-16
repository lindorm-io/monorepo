import { TEST_EC_KEY, TEST_OCT_KEY, TEST_RSA_KEY } from "../../__fixtures__/keys";
import { AesError } from "../../errors";
import { _getEcDecryptionKey } from "./ec/get-ec-keys";
import { _getDecryptionKey } from "./get-decryption-key";
import { _getOctDecryptionKey } from "./oct/get-oct-keys";
import { _getRsaDecryptionKey } from "./rsa/get-rsa-keys";

jest.mock("./ec/get-ec-keys");
jest.mock("./oct/get-oct-keys");
jest.mock("./rsa/get-rsa-keys");

const getEcDecryptionKey = _getEcDecryptionKey as jest.Mock;
const getOctDecryptionKey = _getOctDecryptionKey as jest.Mock;
const getRsaDecryptionKey = _getRsaDecryptionKey as jest.Mock;

describe("getDecryptionKey", () => {
  beforeEach(() => {
    getEcDecryptionKey.mockReturnValue("getEcDecryptionKey");
    getOctDecryptionKey.mockReturnValue("getOctDecryptionKey");
    getRsaDecryptionKey.mockReturnValue("getRsaDecryptionKey");
  });

  afterEach(jest.clearAllMocks);

  test("should resolve decryption key with EC key", () => {
    expect(
      _getDecryptionKey({
        encryption: "aes-256-gcm",
        publicEncryptionKey: Buffer.from("public-encryption-key"),
        publicEncryptionJwk: { crv: "P-521", x: "x", y: "y", kty: "EC" },
        kryptos: TEST_EC_KEY,
      }),
    ).toEqual("getEcDecryptionKey");

    expect(getEcDecryptionKey).toHaveBeenCalled();
  });

  test("should resolve decryption key with RSA key", () => {
    expect(
      _getDecryptionKey({
        encryption: "aes-256-gcm",
        publicEncryptionKey: Buffer.from("public-encryption-key"),
        kryptos: TEST_RSA_KEY,
      }),
    ).toEqual("getRsaDecryptionKey");

    expect(getRsaDecryptionKey).toHaveBeenCalled();
  });

  test("should resolve decryption key with OCT key", () => {
    expect(
      _getDecryptionKey({
        encryption: "aes-256-gcm",
        iterations: 100000,
        salt: Buffer.from("salt"),
        kryptos: TEST_OCT_KEY,
      }),
    ).toEqual("getOctDecryptionKey");

    expect(getOctDecryptionKey).toHaveBeenCalled();
  });

  test("should throw when encryption key algorithm is missing", () => {
    expect(() =>
      _getDecryptionKey({
        encryption: "aes-256-gcm",
        kryptos: TEST_RSA_KEY,
      }),
    ).toThrow(AesError);
  });

  test("should throw when public encryption key is missing", () => {
    expect(() =>
      _getDecryptionKey({
        encryption: "aes-256-gcm",
        kryptos: TEST_RSA_KEY,
      }),
    ).toThrow(AesError);
  });
});
