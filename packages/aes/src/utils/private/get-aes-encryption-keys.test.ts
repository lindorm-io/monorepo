import { AesAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { assertAesCipherSecret as _assertAesCipherSecret } from "./assert-aes-cipher-secret";
import { generateAesEncryptionKey as _generateAesEncryptionKey } from "./generate-aes-encryption-key";
import { getAesEncryptionKeys } from "./get-aes-encryption-keys";
import { isPrivateKey as _isPrivateKey } from "./is-private-key";
import { createPublicEncryptionKey as _createPublicEncryptionKey } from "./public-encryption-key";

jest.mock("./assert-aes-cipher-secret");
jest.mock("./is-private-key");
jest.mock("./generate-aes-encryption-key");
jest.mock("./public-encryption-key");

const assertAesCipherSecret = _assertAesCipherSecret as jest.Mock;
const isPrivateKey = _isPrivateKey as jest.Mock;
const createPublicEncryptionKey = _createPublicEncryptionKey as jest.Mock;
const generateAesEncryptionKey = _generateAesEncryptionKey as jest.Mock;

describe("getAesEncryptionKeys", () => {
  beforeEach(() => {
    assertAesCipherSecret.mockReturnValue(undefined);
    isPrivateKey.mockReturnValue(true);
    generateAesEncryptionKey.mockReturnValue(Buffer.from("encryption-key"));
    createPublicEncryptionKey.mockReturnValue(Buffer.from("public-encryption-key"));
  });

  afterEach(jest.clearAllMocks);

  test("should resolve encryption keys with key", () => {
    expect(
      getAesEncryptionKeys({
        algorithm: AesAlgorithm.AES_256_GCM,
        key: "key",
      }),
    ).toStrictEqual({
      encryptionKey: Buffer.from("encryption-key"),
      isPrivateKey: true,
      publicEncryptionKey: Buffer.from("public-encryption-key"),
    });

    expect(createPublicEncryptionKey).toHaveBeenCalled();
  });

  test("should resolve encryption keys with secret", () => {
    expect(
      getAesEncryptionKeys({
        algorithm: AesAlgorithm.AES_256_GCM,
        secret: "secret",
      }),
    ).toStrictEqual({
      encryptionKey: Buffer.from("secret"),
      isPrivateKey: false,
    });

    expect(createPublicEncryptionKey).not.toHaveBeenCalled();
  });

  test("should throw error with both key and secret", () => {
    expect(() =>
      getAesEncryptionKeys({
        key: "key",
        secret: "secret",
      }),
    ).toThrow(AesError);
  });

  test("should throw error with neither key nor secret", () => {
    expect(() => getAesEncryptionKeys({})).toThrow(AesError);
  });
});
