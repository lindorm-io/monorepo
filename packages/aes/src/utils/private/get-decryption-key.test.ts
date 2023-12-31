import { AesError } from "../../errors";
import { EC_KEY_SET } from "../../fixtures/ec-keys.fixture";
import { OCT_KEY_SET } from "../../fixtures/oct-keys.fixture";
import { RSA_KEY_SET } from "../../fixtures/rsa-keys.fixture";
import { getEcDecryptionKey as _getEcDecryptionKey } from "./ec";
import { getDecryptionKey } from "./get-decryption-key";
import { getOctDecryptionKey as _getOctDecryptionKey } from "./oct";
import { getRsaDecryptionKey as _getRsaDecryptionKey } from "./rsa";

jest.mock("./ec");
jest.mock("./oct");
jest.mock("./rsa");

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
      getDecryptionKey({
        encryption: "aes-256-gcm",
        keySet: EC_KEY_SET,
        encryptionKeyAlgorithm: "ECDH-ES",
        publicEncryptionKey: Buffer.from("public-encryption-key"),
        publicEncryptionJwk: { crv: "P-521", x: "x", y: "y", kty: "EC" },
      }),
    ).toStrictEqual("getEcDecryptionKey");

    expect(getEcDecryptionKey).toHaveBeenCalled();
  });

  test("should resolve decryption key with RSA key", () => {
    expect(
      getDecryptionKey({
        encryption: "aes-256-gcm",
        keySet: RSA_KEY_SET,
        encryptionKeyAlgorithm: "RSA-OAEP-256",
        publicEncryptionKey: Buffer.from("public-encryption-key"),
      }),
    ).toStrictEqual("getRsaDecryptionKey");

    expect(getRsaDecryptionKey).toHaveBeenCalled();
  });

  test("should resolve decryption key with OCT key", () => {
    expect(
      getDecryptionKey({
        encryption: "aes-256-gcm",
        keySet: OCT_KEY_SET,
      }),
    ).toStrictEqual("getOctDecryptionKey");

    expect(getOctDecryptionKey).toHaveBeenCalled();
  });

  test("should throw when encryption key algorithm is missing", () => {
    expect(() =>
      getDecryptionKey({
        encryption: "aes-256-gcm",
        keySet: RSA_KEY_SET,
      }),
    ).toThrow(AesError);
  });

  test("should throw when public encryption key is missing", () => {
    expect(() =>
      getDecryptionKey({
        encryption: "aes-256-gcm",
        keySet: RSA_KEY_SET,
        encryptionKeyAlgorithm: "RSA-OAEP-256",
      }),
    ).toThrow(AesError);
  });
});
