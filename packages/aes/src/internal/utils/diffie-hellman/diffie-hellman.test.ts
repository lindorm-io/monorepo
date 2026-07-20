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

  test("should consume apu/apv in the derivation (matching round-trips, mismatch diverges)", () => {
    const apu = Buffer.from("producer");
    const apv = Buffer.from("recipient");

    const result = getDiffieHellmanEncryptionKey({
      apu,
      apv,
      encryption: "A256GCM",
      kryptos: TEST_EC_KEY,
    });

    // Same ephemeral (fixed publicEncryptionJwk) + same apu/apv -> same CEK.
    expect(
      getDiffieHellmanDecryptionKey({
        apu,
        apv,
        encryption: "A256GCM",
        publicEncryptionJwk: result.publicEncryptionJwk,
        kryptos: TEST_EC_KEY,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });

    // Dropping apu/apv against the SAME ephemeral yields a DIFFERENT key —
    // proving the values are threaded into the KDF, not ignored.
    expect(
      getDiffieHellmanDecryptionKey({
        encryption: "A256GCM",
        publicEncryptionJwk: result.publicEncryptionJwk,
        kryptos: TEST_EC_KEY,
      }).contentEncryptionKey,
    ).not.toEqual(result.contentEncryptionKey);

    // A mismatched apv also diverges.
    expect(
      getDiffieHellmanDecryptionKey({
        apu,
        apv: Buffer.from("other-recipient"),
        encryption: "A256GCM",
        publicEncryptionJwk: result.publicEncryptionJwk,
        kryptos: TEST_EC_KEY,
      }).contentEncryptionKey,
    ).not.toEqual(result.contentEncryptionKey);
  });
});
