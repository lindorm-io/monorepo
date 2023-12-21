import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "../../../enums";
import { PUBLIC_RSA_KEY } from "../../../fixtures/rsa-keys.fixture";
import { generateEncryptionKey as _generateEncryptionKey } from "../generate-encryption-key";
import { isPrivateKey as _isPrivateKey } from "../is-private-key";
import { getRsaDecryptionKey, getRsaEncryptionKeys } from "./get-rsa-keys";
import {
  createPublicEncryptionKey as _createPublicEncryptionKey,
  decryptPublicEncryptionKey as _decryptPublicEncryptionKey,
} from "./public-encryption-key";

jest.mock("../generate-encryption-key");
jest.mock("../is-private-key");
jest.mock("./public-encryption-key");

const generateEncryptionKey = _generateEncryptionKey as jest.Mock;
const isPrivateKey = _isPrivateKey as jest.Mock;
const createPublicEncryptionKey = _createPublicEncryptionKey as jest.Mock;
const decryptPublicEncryptionKey = _decryptPublicEncryptionKey as jest.Mock;

describe("get-rsa-keys", () => {
  beforeEach(() => {
    generateEncryptionKey.mockReturnValue("generateEncryptionKey");
    isPrivateKey.mockReturnValue(true);
    createPublicEncryptionKey.mockReturnValue("createPublicEncryptionKey");
    decryptPublicEncryptionKey.mockReturnValue("decryptPublicEncryptionKey");
  });

  test("should return rsa encryption keys", () => {
    expect(
      getRsaEncryptionKeys({
        algorithm: AesAlgorithm.AES_128_CBC,
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP,
        key: PUBLIC_RSA_KEY,
      }),
    ).toStrictEqual({
      encryptionKey: "generateEncryptionKey",
      isPrivateKey: true,
      publicEncryptionKey: "createPublicEncryptionKey",
    });
  });

  test("should return rsa decryption key", () => {
    expect(
      getRsaDecryptionKey({
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP,
        key: PUBLIC_RSA_KEY,
        publicEncryptionKey: Buffer.from("publicEncryptionKey"),
      }),
    ).toBe("decryptPublicEncryptionKey");
  });
});
