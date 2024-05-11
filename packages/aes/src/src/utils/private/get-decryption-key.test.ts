import { EC_KEY_SET } from "../../__fixtures__/ec-keys.fixture";
import { OCT_KEY_SET } from "../../__fixtures__/oct-keys.fixture";
import { RSA_KEY_SET } from "../../__fixtures__/rsa-keys.fixture";
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
        kryptos: EC_KEY_SET,
        encryptionKeyAlgorithm: "ECDH-ES",
        publicEncryptionKey: Buffer.from("public-encryption-key"),
        publicEncryptionJwk: { crv: "P-521", x: "x", y: "y", kty: "EC" },
      }),
    ).toStrictEqual("getEcDecryptionKey");

    expect(getEcDecryptionKey).toHaveBeenCalled();
  });

  test("should resolve decryption key with RSA key", () => {
    expect(
      _getDecryptionKey({
        encryption: "aes-256-gcm",
        kryptos: RSA_KEY_SET,
        encryptionKeyAlgorithm: "RSA-OAEP-256",
        publicEncryptionKey: Buffer.from("public-encryption-key"),
      }),
    ).toStrictEqual("getRsaDecryptionKey");

    expect(getRsaDecryptionKey).toHaveBeenCalled();
  });

  test("should resolve decryption key with OCT key", () => {
    expect(
      _getDecryptionKey({
        encryption: "aes-256-gcm",
        kryptos: OCT_KEY_SET,
      }),
    ).toStrictEqual("getOctDecryptionKey");

    expect(getOctDecryptionKey).toHaveBeenCalled();
  });

  test("should throw when encryption key algorithm is missing", () => {
    expect(() =>
      _getDecryptionKey({
        encryption: "aes-256-gcm",
        kryptos: RSA_KEY_SET,
      }),
    ).toThrow(AesError);
  });

  test("should throw when public encryption key is missing", () => {
    expect(() =>
      _getDecryptionKey({
        encryption: "aes-256-gcm",
        kryptos: RSA_KEY_SET,
        encryptionKeyAlgorithm: "RSA-OAEP-256",
      }),
    ).toThrow(AesError);
  });
});
