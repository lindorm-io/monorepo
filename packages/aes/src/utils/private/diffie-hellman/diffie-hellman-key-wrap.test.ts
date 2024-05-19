import { Kryptos } from "@lindorm/kryptos";
import {
  _getDiffieHellmanKeyWrapDecryptionKey,
  _getDiffieHellmanKeyWrapEncryptionKey,
} from "./diffie-hellman-key-wrap";

describe("diffieHellman", () => {
  test("should return encryption keys with ECDH-ES+A128KW", () => {
    const kryptos = Kryptos.generate({
      algorithm: "ECDH-ES+A128KW",
      type: "EC",
      use: "enc",
    });

    const result = _getDiffieHellmanKeyWrapEncryptionKey({
      encryption: "A128GCM",
      kryptos,
    });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      publicEncryptionJwk: {
        crv: "P-256",
        kty: "EC",
        x: expect.any(String),
        y: expect.any(String),
      },
      publicEncryptionKey: expect.any(Buffer),
      hkdfSalt: expect.any(Buffer),
    });

    expect(
      _getDiffieHellmanKeyWrapDecryptionKey({
        encryption: "A128GCM",
        publicEncryptionJwk: result.publicEncryptionJwk,
        publicEncryptionKey: result.publicEncryptionKey,
        kryptos,
        hkdfSalt: result.hkdfSalt,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });

  test("should return encryption keys with ECDH-ES+A192KW", () => {
    const kryptos = Kryptos.generate({
      algorithm: "ECDH-ES+A192KW",
      type: "EC",
      use: "enc",
    });

    const result = _getDiffieHellmanKeyWrapEncryptionKey({
      encryption: "A192GCM",
      kryptos,
    });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      publicEncryptionJwk: {
        crv: "P-384",
        kty: "EC",
        x: expect.any(String),
        y: expect.any(String),
      },
      publicEncryptionKey: expect.any(Buffer),
      hkdfSalt: expect.any(Buffer),
    });

    expect(
      _getDiffieHellmanKeyWrapDecryptionKey({
        encryption: "A192GCM",
        publicEncryptionJwk: result.publicEncryptionJwk,
        publicEncryptionKey: result.publicEncryptionKey,
        kryptos,
        hkdfSalt: result.hkdfSalt,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });

  test("should return encryption keys with ECDH-ES+A256KW", () => {
    const kryptos = Kryptos.generate({
      algorithm: "ECDH-ES+A256KW",
      type: "EC",
      use: "enc",
    });

    const result = _getDiffieHellmanKeyWrapEncryptionKey({
      encryption: "A256GCM",
      kryptos,
    });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      publicEncryptionJwk: {
        crv: "P-521",
        kty: "EC",
        x: expect.any(String),
        y: expect.any(String),
      },
      publicEncryptionKey: expect.any(Buffer),
      hkdfSalt: expect.any(Buffer),
    });

    expect(
      _getDiffieHellmanKeyWrapDecryptionKey({
        encryption: "A256GCM",
        publicEncryptionJwk: result.publicEncryptionJwk,
        publicEncryptionKey: result.publicEncryptionKey,
        kryptos,
        hkdfSalt: result.hkdfSalt,
      }),
    ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
  });
});