import { RSA_KEY_SET } from "../../../__fixtures__/rsa-keys.fixture";
import { _generateEncryptionKey } from "./generate-encryption-key";
import { _getRsaDecryptionKey, _getRsaEncryptionKeys } from "./get-rsa-keys";
import { _createPublicEncryptionKey, _decryptPublicEncryptionKey } from "./public-encryption-key";

jest.mock("./generate-encryption-key");
jest.mock("./public-encryption-key");

const generateEncryptionKey = _generateEncryptionKey as jest.Mock;
const createPublicEncryptionKey = _createPublicEncryptionKey as jest.Mock;
const decryptPublicEncryptionKey = _decryptPublicEncryptionKey as jest.Mock;

describe("get-rsa-keys", () => {
  beforeEach(() => {
    generateEncryptionKey.mockReturnValue("generateEncryptionKey");
    createPublicEncryptionKey.mockReturnValue("createPublicEncryptionKey");
    decryptPublicEncryptionKey.mockReturnValue("decryptPublicEncryptionKey");
  });

  test("should return rsa encryption keys", () => {
    expect(
      _getRsaEncryptionKeys({
        encryption: "aes-128-cbc",
        encryptionKeyAlgorithm: "RSA-OAEP",
        kryptos: RSA_KEY_SET,
      }),
    ).toStrictEqual({
      encryptionKey: "generateEncryptionKey",
      publicEncryptionKey: "createPublicEncryptionKey",
    });
  });

  test("should return rsa decryption key", () => {
    expect(
      _getRsaDecryptionKey({
        encryptionKeyAlgorithm: "RSA-OAEP",
        kryptos: RSA_KEY_SET,
        publicEncryptionKey: Buffer.from("publicEncryptionKey"),
      }),
    ).toBe("decryptPublicEncryptionKey");
  });
});
