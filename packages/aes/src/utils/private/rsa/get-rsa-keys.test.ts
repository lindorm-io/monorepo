import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "../../../enums";
import { PUBLIC_RSA_PEM } from "../../../fixtures/rsa-keys.fixture";
import { generateEncryptionKey as _generateEncryptionKey } from "./generate-encryption-key";
import { getRsaDecryptionKey, getRsaEncryptionKeys } from "./get-rsa-keys";
import { getRsaPem as _getRsaPem } from "./get-rsa-pem";
import {
  createPublicEncryptionKey as _createPublicEncryptionKey,
  decryptPublicEncryptionKey as _decryptPublicEncryptionKey,
} from "./public-encryption-key";

jest.mock("./generate-encryption-key");
jest.mock("./get-rsa-pem");
jest.mock("./public-encryption-key");

const getRsaPem = _getRsaPem as jest.Mock;
const generateEncryptionKey = _generateEncryptionKey as jest.Mock;
const createPublicEncryptionKey = _createPublicEncryptionKey as jest.Mock;
const decryptPublicEncryptionKey = _decryptPublicEncryptionKey as jest.Mock;

describe("get-rsa-keys", () => {
  beforeEach(() => {
    getRsaPem.mockReturnValue(PUBLIC_RSA_PEM);
    generateEncryptionKey.mockReturnValue("generateEncryptionKey");
    createPublicEncryptionKey.mockReturnValue("createPublicEncryptionKey");
    decryptPublicEncryptionKey.mockReturnValue("decryptPublicEncryptionKey");
  });

  test("should return rsa encryption keys", () => {
    expect(
      getRsaEncryptionKeys({
        algorithm: AesAlgorithm.AES_128_CBC,
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP,
        key: PUBLIC_RSA_PEM,
      }),
    ).toStrictEqual({
      encryptionKey: "generateEncryptionKey",
      publicEncryptionKey: "createPublicEncryptionKey",
    });
  });

  test("should return rsa decryption key", () => {
    expect(
      getRsaDecryptionKey({
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP,
        key: PUBLIC_RSA_PEM,
        publicEncryptionKey: Buffer.from("publicEncryptionKey"),
      }),
    ).toBe("decryptPublicEncryptionKey");
  });
});
