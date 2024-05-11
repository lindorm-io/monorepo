import { Kryptos } from "@lindorm/kryptos";
import {
  privateDecrypt as _privateDecrypt,
  privateEncrypt as _privateEncrypt,
  publicDecrypt as _publicDecrypt,
  publicEncrypt as _publicEncrypt,
} from "crypto";
import { _createPublicEncryptionKey, _decryptPublicEncryptionKey } from "./public-encryption-key";

jest.mock("crypto");

const privateEncrypt = _privateEncrypt as jest.Mock;
const publicEncrypt = _publicEncrypt as jest.Mock;
const privateDecrypt = _privateDecrypt as jest.Mock;
const publicDecrypt = _publicDecrypt as jest.Mock;

describe("public-encryption-key", () => {
  let kryptos: any;

  beforeEach(() => {
    privateEncrypt.mockReturnValue(Buffer.from("privateEncrypt"));
    publicEncrypt.mockReturnValue(Buffer.from("publicEncrypt"));
    privateDecrypt.mockReturnValue(Buffer.from("privateDecrypt"));
    publicDecrypt.mockReturnValue(Buffer.from("publicDecrypt"));

    kryptos = {
      export: jest.fn().mockReturnValue({
        privateKey: "private-key",
        publicKey: "public-key",
      }),
    } as unknown as Kryptos;
  });

  afterEach(jest.clearAllMocks);

  describe("createPublicEncryptionKey", () => {
    test("should encrypt encryption key with RSA-PRIVATE-KEY", () => {
      expect(
        _createPublicEncryptionKey({
          encryptionKey: Buffer.from("encryption-key"),
          encryptionKeyAlgorithm: "RSA-PRIVATE-KEY",
          kryptos,
        }),
      ).toStrictEqual(Buffer.from("privateEncrypt"));

      expect(privateEncrypt).toHaveBeenCalled();
    });

    test("should encrypt encryption key with RSA-OAEP", () => {
      expect(
        _createPublicEncryptionKey({
          encryptionKey: Buffer.from("encryption-key"),
          encryptionKeyAlgorithm: "RSA-OAEP",
          kryptos,
        }),
      ).toStrictEqual(Buffer.from("publicEncrypt"));

      expect(publicEncrypt).toHaveBeenCalled();
    });
  });

  describe("decryptPublicEncryptionKey", () => {
    test("should decrypt encryption key with RSA-PRIVATE-KEY", () => {
      expect(
        _decryptPublicEncryptionKey({
          encryptionKeyAlgorithm: "RSA-PRIVATE-KEY",
          kryptos,
          publicEncryptionKey: Buffer.from("public-encryption-key"),
        }),
      ).toStrictEqual(Buffer.from("publicDecrypt"));

      expect(publicDecrypt).toHaveBeenCalled();
    });

    test("should decrypt encryption key with RSA-OAEP", () => {
      expect(
        _decryptPublicEncryptionKey({
          encryptionKeyAlgorithm: "RSA-OAEP",
          kryptos,
          publicEncryptionKey: Buffer.from("public-encryption-key"),
        }),
      ).toStrictEqual(Buffer.from("privateDecrypt"));

      expect(privateDecrypt).toHaveBeenCalled();
    });
  });
});
