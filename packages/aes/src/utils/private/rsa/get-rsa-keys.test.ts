import { RSA_KEY_SET } from "../../../fixtures/rsa-keys.fixture";
import { generateEncryptionKey as _generateEncryptionKey } from "./generate-encryption-key";
import { getRsaDecryptionKey, getRsaEncryptionKeys } from "./get-rsa-keys";
import {
  createPublicEncryptionKey as _createPublicEncryptionKey,
  decryptPublicEncryptionKey as _decryptPublicEncryptionKey,
} from "./public-encryption-key";

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
      getRsaEncryptionKeys({
        encryption: "aes-128-cbc",
        encryptionKeyAlgorithm: "RSA-OAEP",
        keySet: RSA_KEY_SET,
      }),
    ).toStrictEqual({
      encryptionKey: "generateEncryptionKey",
      publicEncryptionKey: "createPublicEncryptionKey",
    });
  });

  test("should return rsa decryption key", () => {
    expect(
      getRsaDecryptionKey({
        encryptionKeyAlgorithm: "RSA-OAEP",
        keySet: RSA_KEY_SET,
        publicEncryptionKey: Buffer.from("publicEncryptionKey"),
      }),
    ).toBe("decryptPublicEncryptionKey");
  });
});
