import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { assertAesCipherSecret as _assertAesCipherSecret } from "./assert-aes-cipher-secret";
import { getAesDecryptionKey } from "./get-aes-decryption-key";
import { decryptPublicEncryptionKey as _decryptPublicEncryptionKey } from "./public-encryption-key";

jest.mock("./public-encryption-key");
jest.mock("./assert-aes-cipher-secret");

const assertAesCipherSecret = _assertAesCipherSecret as jest.Mock;
const decryptPublicEncryptionKey = _decryptPublicEncryptionKey as jest.Mock;

describe("getAesDecryptionKey", () => {
  beforeEach(() => {
    assertAesCipherSecret.mockReturnValue(undefined);
    decryptPublicEncryptionKey.mockReturnValue(Buffer.from("encryption-key"));
  });

  afterEach(jest.clearAllMocks);

  test("should resolve decryption key with key", () => {
    expect(
      getAesDecryptionKey({
        algorithm: AesAlgorithm.AES_256_GCM,
        key: "key",
        encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.SHA256,
        publicEncryptionKey: Buffer.from("public-encryption-key"),
      }),
    ).toStrictEqual(Buffer.from("encryption-key"));

    expect(decryptPublicEncryptionKey).toHaveBeenCalled();
  });

  test("should resolve decryption key with secret", () => {
    expect(
      getAesDecryptionKey({
        algorithm: AesAlgorithm.AES_256_GCM,
        secret: "secret",
      }),
    ).toStrictEqual(Buffer.from("secret"));

    expect(decryptPublicEncryptionKey).not.toHaveBeenCalled();
  });

  test("should throw error with both key and secret", () => {
    expect(() =>
      getAesDecryptionKey({
        algorithm: AesAlgorithm.AES_256_GCM,
        key: "key",
        secret: "secret",
      }),
    ).toThrow(AesError);
  });

  test("should throw error with neither key nor secret", () => {
    expect(() =>
      getAesDecryptionKey({
        algorithm: AesAlgorithm.AES_256_GCM,
      }),
    ).toThrow(AesError);
  });
});
