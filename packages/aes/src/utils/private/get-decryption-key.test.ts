import {
  TEST_EC_KEY,
  TEST_OCT_KEY,
  TEST_OKP_KEY,
  TEST_RSA_KEY,
} from "../../__fixtures__/keys";
import { AesError } from "../../errors";
import { _getDiffieHellmanDecryptionKey } from "./encryption-keys/shared-secret";
import { _getDecryptionKey } from "./get-decryption-key";
import { _getOctDecryptionKey } from "./oct/get-oct-keys";
import { _getRsaDecryptionKey } from "./rsa/get-rsa-keys";

jest.mock("./encryption-keys/shared-secret");
jest.mock("./oct/get-oct-keys");
jest.mock("./rsa/get-rsa-keys");

const getDiffieHellmanDecryptionKey = _getDiffieHellmanDecryptionKey as jest.Mock;
const getOctDecryptionKey = _getOctDecryptionKey as jest.Mock;
const getRsaDecryptionKey = _getRsaDecryptionKey as jest.Mock;

describe("getDecryptionKey", () => {
  beforeEach(() => {
    getDiffieHellmanDecryptionKey.mockReturnValue("getDiffieHellmanDecryptionKey");
    getOctDecryptionKey.mockReturnValue("getOctDecryptionKey");
    getRsaDecryptionKey.mockReturnValue("getRsaDecryptionKey");
  });

  afterEach(jest.clearAllMocks);

  test("should resolve decryption key with EC key", () => {
    expect(
      _getDecryptionKey({
        encryption: "aes-256-gcm",
        kryptos: TEST_EC_KEY,
        publicEncryptionJwk: { crv: "P-521", x: "x", y: "y", kty: "EC" },
        salt: Buffer.from("salt"),
      }),
    ).toEqual("getDiffieHellmanDecryptionKey");

    expect(getDiffieHellmanDecryptionKey).toHaveBeenCalled();
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

  test("should resolve decryption key with OKP key", () => {
    expect(
      _getDecryptionKey({
        encryption: "aes-256-gcm",
        kryptos: TEST_OKP_KEY,
        publicEncryptionJwk: { crv: "P-521", x: "x", y: "y", kty: "EC" },
        salt: Buffer.from("salt"),
      }),
    ).toEqual("getDiffieHellmanDecryptionKey");

    expect(getDiffieHellmanDecryptionKey).toHaveBeenCalled();
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
