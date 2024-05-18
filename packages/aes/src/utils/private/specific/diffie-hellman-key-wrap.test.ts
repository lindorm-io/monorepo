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
      encryption: "aes-128-gcm",
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
      salt: expect.any(Buffer),
    });

    expect(
      _getDiffieHellmanKeyWrapDecryptionKey({
        encryption: "aes-128-gcm",
        publicEncryptionJwk: result.publicEncryptionJwk,
        publicEncryptionKey: result.publicEncryptionKey,
        kryptos,
        salt: result.salt,
      }),
    ).toEqual(result.contentEncryptionKey);
  });

  test("should return encryption keys with ECDH-ES+A192KW", () => {
    const kryptos = Kryptos.generate({
      algorithm: "ECDH-ES+A192KW",
      type: "EC",
      use: "enc",
    });

    const result = _getDiffieHellmanKeyWrapEncryptionKey({
      encryption: "aes-192-gcm",
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
      salt: expect.any(Buffer),
    });

    expect(
      _getDiffieHellmanKeyWrapDecryptionKey({
        encryption: "aes-192-gcm",
        publicEncryptionJwk: result.publicEncryptionJwk,
        publicEncryptionKey: result.publicEncryptionKey,
        kryptos,
        salt: result.salt,
      }),
    ).toEqual(result.contentEncryptionKey);
  });

  test("should return encryption keys with ECDH-ES+A256KW", () => {
    const kryptos = Kryptos.generate({
      algorithm: "ECDH-ES+A256KW",
      type: "EC",
      use: "enc",
    });

    const result = _getDiffieHellmanKeyWrapEncryptionKey({
      encryption: "aes-256-gcm",
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
      salt: expect.any(Buffer),
    });

    expect(
      _getDiffieHellmanKeyWrapDecryptionKey({
        encryption: "aes-256-gcm",
        publicEncryptionJwk: result.publicEncryptionJwk,
        publicEncryptionKey: result.publicEncryptionKey,
        kryptos,
        salt: result.salt,
      }),
    ).toEqual(result.contentEncryptionKey);
  });
});
