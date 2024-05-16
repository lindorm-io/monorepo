import { TEST_EC_KEY, TEST_OKP_KEY } from "../../../__fixtures__/keys";
import {
  _getDiffieHellmanDecryptionKey,
  _getDiffieHellmanEncryptionKey,
} from "./shared-secret";

describe("shared-secret", () => {
  describe("encryption key", () => {
    test("should return encryption keys for EC", () => {
      expect(
        _getDiffieHellmanEncryptionKey({
          encryption: "aes-256-gcm",
          kryptos: TEST_EC_KEY,
        }),
      ).toEqual({
        encryptionKey: expect.any(Buffer),
        publicEncryptionJwk: {
          crv: "P-521",
          x: expect.any(String),
          y: expect.any(String),
          kty: "EC",
        },
        salt: expect.any(Buffer),
      });
    });

    test("should return encryption keys for OKP", () => {
      expect(
        _getDiffieHellmanEncryptionKey({
          encryption: "aes-256-gcm",
          kryptos: TEST_OKP_KEY,
        }),
      ).toEqual({
        encryptionKey: expect.any(Buffer),
        publicEncryptionJwk: {
          crv: "X25519",
          x: expect.any(String),
          kty: "OKP",
        },
        salt: expect.any(Buffer),
      });
    });
  });

  describe("decrypt", () => {
    test("should encrypt and decrypt EC", () => {
      const { encryptionKey, publicEncryptionJwk, salt } = _getDiffieHellmanEncryptionKey(
        {
          encryption: "aes-256-gcm",
          kryptos: TEST_EC_KEY,
        },
      );

      const decryptionKey = _getDiffieHellmanDecryptionKey({
        encryption: "aes-256-gcm",
        publicEncryptionJwk,
        kryptos: TEST_EC_KEY,
        salt,
      });

      expect(encryptionKey).toEqual(decryptionKey);
    });

    test("should return encryption keys for OKP", () => {
      const { encryptionKey, publicEncryptionJwk, salt } = _getDiffieHellmanEncryptionKey(
        {
          encryption: "aes-256-gcm",
          kryptos: TEST_OKP_KEY,
        },
      );

      const decryptionKey = _getDiffieHellmanDecryptionKey({
        encryption: "aes-256-gcm",
        publicEncryptionJwk,
        kryptos: TEST_OKP_KEY,
        salt,
      });

      expect(encryptionKey).toEqual(decryptionKey);
    });
  });
});
