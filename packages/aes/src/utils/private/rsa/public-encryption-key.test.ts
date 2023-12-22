import {
  privateDecrypt as _privateDecrypt,
  privateEncrypt as _privateEncrypt,
  publicDecrypt as _publicDecrypt,
  publicEncrypt as _publicEncrypt,
} from "crypto";
import { AesEncryptionKeyAlgorithm } from "../../../enums";
import { PRIVATE_RSA_PEM, PUBLIC_RSA_PEM } from "../../../fixtures/rsa-keys.fixture";
import { createPublicEncryptionKey, decryptPublicEncryptionKey } from "./public-encryption-key";

jest.mock("crypto");

const privateEncrypt = _privateEncrypt as jest.Mock;
const publicEncrypt = _publicEncrypt as jest.Mock;
const privateDecrypt = _privateDecrypt as jest.Mock;
const publicDecrypt = _publicDecrypt as jest.Mock;

describe("public-encryption-key", () => {
  beforeEach(() => {
    privateEncrypt.mockReturnValue(Buffer.from("privateEncrypt"));
    publicEncrypt.mockReturnValue(Buffer.from("publicEncrypt"));
    privateDecrypt.mockReturnValue(Buffer.from("privateDecrypt"));
    publicDecrypt.mockReturnValue(Buffer.from("publicDecrypt"));
  });

  afterEach(jest.clearAllMocks);

  describe("createPublicEncryptionKey", () => {
    test("should encrypt encryption key using private key pair", () => {
      expect(
        createPublicEncryptionKey({
          encryptionKey: Buffer.from("encryption-key"),
          encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_256,
          pem: PRIVATE_RSA_PEM,
        }),
      ).toStrictEqual(Buffer.from("privateEncrypt"));

      expect(privateEncrypt).toHaveBeenCalled();
    });

    test("should encrypt encryption key using public key pair", () => {
      expect(
        createPublicEncryptionKey({
          encryptionKey: Buffer.from("encryption-key"),
          encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_256,
          pem: PUBLIC_RSA_PEM,
        }),
      ).toStrictEqual(Buffer.from("publicEncrypt"));

      expect(publicEncrypt).toHaveBeenCalled();
    });
  });

  describe("decryptPublicEncryptionKey", () => {
    test("should decrypt encryption key using private key pair", () => {
      expect(
        decryptPublicEncryptionKey({
          encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_256,
          pem: PRIVATE_RSA_PEM,
          publicEncryptionKey: Buffer.from("public-encryption-key"),
        }),
      ).toStrictEqual(Buffer.from("privateDecrypt"));

      expect(privateDecrypt).toHaveBeenCalled();
    });

    test("should decrypt encryption key using public key pair", () => {
      expect(
        decryptPublicEncryptionKey({
          encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_256,
          pem: PUBLIC_RSA_PEM,
          publicEncryptionKey: Buffer.from("public-encryption-key"),
        }),
      ).toStrictEqual(Buffer.from("publicDecrypt"));

      expect(publicDecrypt).toHaveBeenCalled();
    });
  });
});
