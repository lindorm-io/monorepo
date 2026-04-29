import { TEST_EC_KEY, TEST_OKP_KEY } from "../../../__fixtures__/keys.js";
import {
  getDiffieHellmanDecryptionKey,
  getDiffieHellmanEncryptionKey,
} from "./diffie-hellman.js";
import { describe, expect, test } from "vitest";

describe("diffieHellman", () => {
  test("should return encryption keys with EC", () => {
    const result = getDiffieHellmanEncryptionKey({
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
    });

    expect(
      getDiffieHellmanDecryptionKey({
        encryption: "A256GCM",
        publicEncryptionJwk: result.publicEncryptionJwk,
        kryptos: TEST_EC_KEY,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });

  test("should return encryption keys with OKP", () => {
    const result = getDiffieHellmanEncryptionKey({
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
    });

    expect(
      getDiffieHellmanDecryptionKey({
        encryption: "A256GCM",
        publicEncryptionJwk: result.publicEncryptionJwk,
        kryptos: TEST_OKP_KEY,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });
});
