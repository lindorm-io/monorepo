import { KryptosKit } from "@lindorm/kryptos";
import {
  getDiffieHellmanKeyWrapDecryptionKey,
  getDiffieHellmanKeyWrapEncryptionKey,
} from "./diffie-hellman-key-wrap";

describe("diffieHellman", () => {
  describe("ECB", () => {
    test("should return encryption keys with ECDH-ES+A128KW", () => {
      const kryptos = KryptosKit.make.enc.ec({ algorithm: "ECDH-ES+A128KW" });

      const result = getDiffieHellmanKeyWrapEncryptionKey({
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
        getDiffieHellmanKeyWrapDecryptionKey({
          encryption: "A128GCM",
          publicEncryptionJwk: result.publicEncryptionJwk,
          publicEncryptionKey: result.publicEncryptionKey,
          kryptos,
          hkdfSalt: result.hkdfSalt,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });

    test("should return encryption keys with ECDH-ES+A192KW", () => {
      const kryptos = KryptosKit.make.enc.ec({ algorithm: "ECDH-ES+A192KW" });

      const result = getDiffieHellmanKeyWrapEncryptionKey({
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
        getDiffieHellmanKeyWrapDecryptionKey({
          encryption: "A192GCM",
          publicEncryptionJwk: result.publicEncryptionJwk,
          publicEncryptionKey: result.publicEncryptionKey,
          kryptos,
          hkdfSalt: result.hkdfSalt,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });

    test("should return encryption keys with ECDH-ES+A256KW", () => {
      const kryptos = KryptosKit.make.enc.ec({ algorithm: "ECDH-ES+A256KW" });

      const result = getDiffieHellmanKeyWrapEncryptionKey({
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
        getDiffieHellmanKeyWrapDecryptionKey({
          encryption: "A256GCM",
          publicEncryptionJwk: result.publicEncryptionJwk,
          publicEncryptionKey: result.publicEncryptionKey,
          kryptos,
          hkdfSalt: result.hkdfSalt,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });
  });

  describe("GCM", () => {
    test("should return encryption keys with ECDH-ES+A128GCMKW", () => {
      const kryptos = KryptosKit.make.enc.ec({ algorithm: "ECDH-ES+A128GCMKW" });

      const result = getDiffieHellmanKeyWrapEncryptionKey({
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
        publicEncryptionIv: expect.any(Buffer),
        publicEncryptionKey: expect.any(Buffer),
        publicEncryptionTag: expect.any(Buffer),
        hkdfSalt: expect.any(Buffer),
      });

      expect(
        getDiffieHellmanKeyWrapDecryptionKey({
          encryption: "A128GCM",
          publicEncryptionJwk: result.publicEncryptionJwk,
          publicEncryptionIv: result.publicEncryptionIv,
          publicEncryptionKey: result.publicEncryptionKey,
          publicEncryptionTag: result.publicEncryptionTag,
          kryptos,
          hkdfSalt: result.hkdfSalt,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });

    test("should return encryption keys with ECDH-ES+A192GCMKW", () => {
      const kryptos = KryptosKit.make.enc.ec({ algorithm: "ECDH-ES+A192GCMKW" });

      const result = getDiffieHellmanKeyWrapEncryptionKey({
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
        publicEncryptionIv: expect.any(Buffer),
        publicEncryptionKey: expect.any(Buffer),
        publicEncryptionTag: expect.any(Buffer),
        hkdfSalt: expect.any(Buffer),
      });

      expect(
        getDiffieHellmanKeyWrapDecryptionKey({
          encryption: "A192GCM",
          publicEncryptionJwk: result.publicEncryptionJwk,
          publicEncryptionIv: result.publicEncryptionIv,
          publicEncryptionKey: result.publicEncryptionKey,
          publicEncryptionTag: result.publicEncryptionTag,
          kryptos,
          hkdfSalt: result.hkdfSalt,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });

    test("should return encryption keys with ECDH-ES+A256GCMKW", () => {
      const kryptos = KryptosKit.make.enc.ec({ algorithm: "ECDH-ES+A256GCMKW" });

      const result = getDiffieHellmanKeyWrapEncryptionKey({
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
        publicEncryptionIv: expect.any(Buffer),
        publicEncryptionKey: expect.any(Buffer),
        publicEncryptionTag: expect.any(Buffer),
        hkdfSalt: expect.any(Buffer),
      });

      expect(
        getDiffieHellmanKeyWrapDecryptionKey({
          encryption: "A256GCM",
          publicEncryptionJwk: result.publicEncryptionJwk,
          publicEncryptionIv: result.publicEncryptionIv,
          publicEncryptionKey: result.publicEncryptionKey,
          publicEncryptionTag: result.publicEncryptionTag,
          kryptos,
          hkdfSalt: result.hkdfSalt,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });
  });

  describe("OKP", () => {
    test("should return encryption keys with X25519 OKP and GCM KW", () => {
      const kryptos = KryptosKit.make.enc.okp({
        algorithm: "ECDH-ES+A128GCMKW",
        curve: "X25519",
      });

      const result = getDiffieHellmanKeyWrapEncryptionKey({
        encryption: "A128GCM",
        kryptos,
      });

      expect(result).toEqual({
        contentEncryptionKey: expect.any(Buffer),
        publicEncryptionJwk: {
          crv: "X25519",
          kty: "OKP",
          x: expect.any(String),
        },
        publicEncryptionIv: expect.any(Buffer),
        publicEncryptionKey: expect.any(Buffer),
        publicEncryptionTag: expect.any(Buffer),
        hkdfSalt: expect.any(Buffer),
      });

      expect(
        getDiffieHellmanKeyWrapDecryptionKey({
          encryption: "A128GCM",
          publicEncryptionJwk: result.publicEncryptionJwk,
          publicEncryptionIv: result.publicEncryptionIv,
          publicEncryptionKey: result.publicEncryptionKey,
          publicEncryptionTag: result.publicEncryptionTag,
          kryptos,
          hkdfSalt: result.hkdfSalt,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });

    test("should return encryption keys with X448 OKP and ECB KW", () => {
      const kryptos = KryptosKit.make.enc.okp({
        algorithm: "ECDH-ES+A192KW",
        curve: "X448",
      });

      const result = getDiffieHellmanKeyWrapEncryptionKey({
        encryption: "A192GCM",
        kryptos,
      });

      expect(result).toEqual({
        contentEncryptionKey: expect.any(Buffer),
        publicEncryptionJwk: {
          crv: "X448",
          kty: "OKP",
          x: expect.any(String),
        },
        publicEncryptionKey: expect.any(Buffer),
        hkdfSalt: expect.any(Buffer),
      });

      expect(
        getDiffieHellmanKeyWrapDecryptionKey({
          encryption: "A192GCM",
          publicEncryptionJwk: result.publicEncryptionJwk,
          publicEncryptionKey: result.publicEncryptionKey,
          kryptos,
          hkdfSalt: result.hkdfSalt,
        }),
      ).toEqual({ contentEncryptionKey: result.contentEncryptionKey });
    });
  });
});
