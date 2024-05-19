import { TEST_EC_KEY, TEST_OKP_KEY } from "../../../__fixtures__/keys";
import {
  _getDiffieHellmanDecryptionKey,
  _getDiffieHellmanEncryptionKey,
} from "./diffie-hellman";

describe("diffieHellman", () => {
  test("should return encryption keys with EC", () => {
    const result = _getDiffieHellmanEncryptionKey({
      encryption: "A256GCM",
      kryptos: TEST_EC_KEY,
    });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      publicEncryptionJwk: {
        crv: "P-521",
        kty: "EC",
        x: expect.any(String),
        y: expect.any(String),
      },
      hkdfSalt: expect.any(Buffer),
    });

    expect(
      _getDiffieHellmanDecryptionKey({
        encryption: "A256GCM",
        publicEncryptionJwk: result.publicEncryptionJwk,
        kryptos: TEST_EC_KEY,
        hkdfSalt: result.hkdfSalt,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });

  test("should return encryption keys with OKP", () => {
    const result = _getDiffieHellmanEncryptionKey({
      encryption: "A256GCM",
      kryptos: TEST_OKP_KEY,
    });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      publicEncryptionJwk: {
        crv: "X25519",
        kty: "OKP",
        x: expect.any(String),
      },
      hkdfSalt: expect.any(Buffer),
    });

    expect(
      _getDiffieHellmanDecryptionKey({
        encryption: "A256GCM",
        publicEncryptionJwk: result.publicEncryptionJwk,
        kryptos: TEST_OKP_KEY,
        hkdfSalt: result.hkdfSalt,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });
});
