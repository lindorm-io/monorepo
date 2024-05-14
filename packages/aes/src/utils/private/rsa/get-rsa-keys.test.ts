import { TEST_RSA_KEY } from "../../../__fixtures__/keys";
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
        kryptos: TEST_RSA_KEY,
      }),
    ).toEqual({
      encryptionKey: "generateEncryptionKey",
      publicEncryptionKey: "createPublicEncryptionKey",
    });
  });

  test("should return rsa decryption key", () => {
    expect(
      _getRsaDecryptionKey({
        publicEncryptionKey: Buffer.from("publicEncryptionKey"),
        kryptos: TEST_RSA_KEY,
      }),
    ).toBe("decryptPublicEncryptionKey");
  });
});
