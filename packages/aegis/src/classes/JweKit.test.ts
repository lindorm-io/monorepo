import { type KryptosAlgorithm, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import MockDate from "mockdate";
import {
  TEST_EC_KEY_ENC,
  TEST_OCT_KEY_ENC,
  TEST_OKP_KEY_ENC,
  TEST_RSA_KEY_ENC,
} from "../__fixtures__/keys.js";
import { JweKit } from "./JweKit.js";
import { beforeEach, describe, expect, test } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("JweKit", () => {
  let logger: ILogger;
  let kit: JweKit;

  beforeEach(() => {
    logger = createMockLogger();
    kit = new JweKit({ logger, kryptos: TEST_EC_KEY_ENC });
  });

  describe("encrypt", () => {
    test("should encrypt data using EC", () => {
      expect(kit.encrypt("data")).toEqual({
        token: expect.any(String),
      });
    });

    test("should encrypt data using OCT", () => {
      kit = new JweKit({ logger, kryptos: TEST_OCT_KEY_ENC });

      expect(kit.encrypt("data")).toEqual({
        token: expect.any(String),
      });
    });

    test("should encrypt data using OKP", () => {
      kit = new JweKit({ logger, kryptos: TEST_OKP_KEY_ENC });

      expect(kit.encrypt("data")).toEqual({
        token: expect.any(String),
      });
    });

    test("should encrypt data using RSA", () => {
      kit = new JweKit({ logger, kryptos: TEST_RSA_KEY_ENC });

      expect(kit.encrypt("data")).toEqual({
        token: expect.any(String),
      });
    });
  });

  describe("decrypt", () => {
    test("should decrypt data using EC", () => {
      const { token } = kit.encrypt("data", {
        objectId: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03",
      });

      expect(kit.decrypt(token)).toEqual({
        decoded: {
          authTag: expect.any(String),
          content: expect.any(String),
          header: {
            alg: "ECDH-ES",
            cty: "text/plain; charset=utf-8",
            enc: "A256GCM",
            epk: {
              crv: "P-521",
              kty: "EC",
              x: expect.any(String),
              y: expect.any(String),
            },
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            kid: "43bd1720-5dab-5d52-ae1e-e9dbbe6adfe4",
            oid: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03",
            typ: "JWE",
          },
          initialisationVector: expect.any(String),
          publicEncryptionKey: undefined,
        },
        header: {
          algorithm: "ECDH-ES",
          baseFormat: "JWE",
          contentType: "text/plain; charset=utf-8",
          critical: [],
          encryption: "A256GCM",
          headerType: "JWE",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: "43bd1720-5dab-5d52-ae1e-e9dbbe6adfe4",
          objectId: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03",
          publicEncryptionJwk: {
            crv: "P-521",
            kty: "EC",
            x: expect.any(String),
            y: expect.any(String),
          },
        },
        payload: "data",
        token,
      });
    });

    test("should decrypt data using OCT dir", () => {
      kit = new JweKit({ logger, kryptos: TEST_OCT_KEY_ENC });

      const { token } = kit.encrypt("data", {
        objectId: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
      });

      expect(kit.decrypt(token)).toEqual({
        decoded: {
          authTag: expect.any(String),
          content: expect.any(String),
          header: {
            alg: "dir",
            cty: "text/plain; charset=utf-8",
            enc: "A256GCM",
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            kid: "ae26175f-961d-5947-8318-6299e4576b83",
            oid: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
            typ: "JWE",
          },
          initialisationVector: expect.any(String),
          publicEncryptionKey: undefined,
        },
        header: {
          algorithm: "dir",
          baseFormat: "JWE",
          contentType: "text/plain; charset=utf-8",
          critical: [],
          encryption: "A256GCM",
          headerType: "JWE",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: "ae26175f-961d-5947-8318-6299e4576b83",
          objectId: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
        },
        payload: "data",
        token,
      });
    });

    test("should decrypt data using OCT hkdf", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "A128KW",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
      });

      kit = new JweKit({ logger, kryptos });

      const { token } = kit.encrypt("data", {
        objectId: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
      });

      expect(kit.decrypt(token)).toEqual({
        decoded: {
          authTag: expect.any(String),
          content: expect.any(String),
          header: {
            alg: "A128KW",
            cty: "text/plain; charset=utf-8",
            enc: "A256GCM",
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            kid: kryptos.id,
            oid: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
            typ: "JWE",
          },
          initialisationVector: expect.any(String),
          publicEncryptionKey: expect.any(String),
        },
        header: {
          algorithm: "A128KW",
          baseFormat: "JWE",
          contentType: "text/plain; charset=utf-8",
          critical: [],
          encryption: "A256GCM",
          headerType: "JWE",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: kryptos.id,
          objectId: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
        },
        payload: "data",
        token,
      });
    });

    test("should decrypt data using OCT pbkdf", () => {
      const kryptos = KryptosKit.generate.enc.oct({ algorithm: "PBES2-HS512+A256KW" });

      kit = new JweKit({ logger, kryptos });

      const { token } = kit.encrypt("data", {
        objectId: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
      });

      expect(kit.decrypt(token)).toEqual({
        decoded: {
          authTag: expect.any(String),
          content: expect.any(String),
          header: {
            alg: "PBES2-HS512+A256KW",
            cty: "text/plain; charset=utf-8",
            enc: "A256GCM",
            kid: kryptos.id,
            oid: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
            p2c: expect.any(Number),
            p2s: expect.any(String),
            typ: "JWE",
          },
          initialisationVector: expect.any(String),
          publicEncryptionKey: expect.any(String),
        },
        header: {
          algorithm: "PBES2-HS512+A256KW",
          baseFormat: "JWE",
          contentType: "text/plain; charset=utf-8",
          critical: [],
          encryption: "A256GCM",
          headerType: "JWE",
          keyId: kryptos.id,
          objectId: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
          pbkdfIterations: expect.any(Number),
          pbkdfSalt: expect.any(String),
        },
        payload: "data",
        token,
      });
    });

    test("should decrypt data using OCT A128GCMKW", () => {
      const kryptos = KryptosKit.generate.enc.oct({ algorithm: "A128GCMKW" });

      kit = new JweKit({ logger, kryptos });

      const { token } = kit.encrypt("data", {
        objectId: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
      });

      expect(kit.decrypt(token)).toEqual({
        decoded: {
          authTag: expect.any(String),
          content: expect.any(String),
          header: {
            alg: "A128GCMKW",
            cty: "text/plain; charset=utf-8",
            enc: "A256GCM",
            iv: expect.any(String),
            kid: kryptos.id,
            oid: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
            tag: expect.any(String),
            typ: "JWE",
          },
          initialisationVector: expect.any(String),
          publicEncryptionKey: expect.any(String),
        },
        header: {
          algorithm: "A128GCMKW",
          baseFormat: "JWE",
          contentType: "text/plain; charset=utf-8",
          critical: [],
          encryption: "A256GCM",
          headerType: "JWE",
          initialisationVector: expect.any(String),
          keyId: kryptos.id,
          objectId: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
          publicEncryptionTag: expect.any(String),
        },
        payload: "data",
        token,
      });
    });

    test("should decrypt data using OKP", () => {
      kit = new JweKit({ logger, kryptos: TEST_OKP_KEY_ENC });

      const { token } = kit.encrypt("data", {
        objectId: "540061f3-aea2-4625-b034-c48a7a9ac114",
      });

      expect(kit.decrypt(token)).toEqual({
        decoded: {
          authTag: expect.any(String),
          content: expect.any(String),
          header: {
            alg: "ECDH-ES",
            cty: "text/plain; charset=utf-8",
            enc: "A256GCM",
            epk: {
              crv: "X25519",
              kty: "OKP",
              x: expect.any(String),
            },
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            kid: "035f7f00-8101-5387-a935-e92f57347309",
            oid: "540061f3-aea2-4625-b034-c48a7a9ac114",
            typ: "JWE",
          },
          initialisationVector: expect.any(String),
          publicEncryptionKey: undefined,
        },
        header: {
          algorithm: "ECDH-ES",
          baseFormat: "JWE",
          contentType: "text/plain; charset=utf-8",
          critical: [],
          encryption: "A256GCM",
          headerType: "JWE",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: "035f7f00-8101-5387-a935-e92f57347309",
          objectId: "540061f3-aea2-4625-b034-c48a7a9ac114",
          publicEncryptionJwk: {
            crv: "X25519",
            kty: "OKP",
            x: expect.any(String),
          },
        },
        payload: "data",
        token,
      });
    });

    test("should decrypt data using RSA", () => {
      kit = new JweKit({ logger, kryptos: TEST_RSA_KEY_ENC });

      const { token } = kit.encrypt("data", {
        objectId: "a152d3f3-4e4b-46ea-ac6f-ae54e0e79090",
      });

      expect(kit.decrypt(token)).toEqual({
        decoded: {
          authTag: expect.any(String),
          content: expect.any(String),
          header: {
            alg: "RSA-OAEP-256",
            cty: "text/plain; charset=utf-8",
            enc: "A256GCM",
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            kid: "20b09138-bab7-54ce-a491-1f4ba52e3d4e",
            oid: "a152d3f3-4e4b-46ea-ac6f-ae54e0e79090",
            typ: "JWE",
          },
          initialisationVector: expect.any(String),
          publicEncryptionKey: expect.any(String),
        },
        header: {
          algorithm: "RSA-OAEP-256",
          baseFormat: "JWE",
          contentType: "text/plain; charset=utf-8",
          critical: [],
          encryption: "A256GCM",
          headerType: "JWE",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: "20b09138-bab7-54ce-a491-1f4ba52e3d4e",
          objectId: "a152d3f3-4e4b-46ea-ac6f-ae54e0e79090",
        },
        payload: "data",
        token,
      });
    });
  });

  describe("decode", () => {
    test("should decode data", () => {
      const { token } = kit.encrypt("data", {
        objectId: "e5d4ed15-3350-4fdc-a9cf-d8270d637e99",
      });

      expect(JweKit.decode(token)).toEqual({
        authTag: expect.any(String),
        content: expect.any(String),
        header: {
          alg: "ECDH-ES",
          cty: "text/plain; charset=utf-8",
          enc: "A256GCM",
          epk: {
            crv: "P-521",
            kty: "EC",
            x: expect.any(String),
            y: expect.any(String),
          },
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "43bd1720-5dab-5d52-ae1e-e9dbbe6adfe4",
          oid: "e5d4ed15-3350-4fdc-a9cf-d8270d637e99",
          typ: "JWE",
        },
        initialisationVector: expect.any(String),
        publicEncryptionKey: undefined,
      });
    });
  });

  describe("algorithms", () => {
    const algorithms: Array<KryptosAlgorithm> = [
      "A128GCMKW",
      "A128KW",
      "A192GCMKW",
      "A192KW",
      "A256GCMKW",
      "A256KW",
      "dir",
      "ECDH-ES",
      "ECDH-ES+A128GCMKW",
      "ECDH-ES+A128KW",
      "ECDH-ES+A192GCMKW",
      "ECDH-ES+A192KW",
      "ECDH-ES+A256GCMKW",
      "ECDH-ES+A256KW",
      "PBES2-HS256+A128KW",
      "PBES2-HS384+A192KW",
      "PBES2-HS512+A256KW",
      "RSA-OAEP-256",
      "RSA-OAEP-384",
      "RSA-OAEP-512",
      "RSA-OAEP",
    ];

    test.each(algorithms)("should encrypt and decrypt data using %s", (algorithm) => {
      const kryptos = KryptosKit.generate.auto({ algorithm });

      const jweKit = new JweKit({ logger, kryptos });

      const { token } = jweKit.encrypt("data");

      expect(jweKit.decrypt(token)).toBeDefined();
    });
  });

  describe("critical header parameter rejection", () => {
    test("should reject RFC-valid token with an extension critical parameter aegis does not implement", () => {
      const { token } = kit.encrypt("data", {
        objectId: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03",
      });

      // Well-formed header with a non-registered crit parameter that is
      // present. Aegis should still reject — it doesn't implement any
      // extension parameters.
      const decoded = JweKit.decode(token);
      const headerWithCrit = {
        ...decoded.header,
        crit: ["lindorm_ext"],
        lindorm_ext: "some-value",
      };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, ...parts.slice(1)].join(".");

      expect(() => kit.decrypt(modifiedToken)).toThrow(
        "Unsupported critical header parameter: lindorm_ext",
      );
    });

    test("should reject malformed crit listing a parameter not present in the header", () => {
      const { token } = kit.encrypt("data", {
        objectId: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03",
      });

      const decoded = JweKit.decode(token);
      const headerWithCrit = { ...decoded.header, crit: ["missing_ext"] };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, ...parts.slice(1)].join(".");

      expect(() => kit.decrypt(modifiedToken)).toThrow(/not present/);
    });

    test("should reject crit containing an IANA-registered parameter name", () => {
      const { token } = kit.encrypt("data", {
        objectId: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03",
      });

      const decoded = JweKit.decode(token);
      const headerWithCrit = { ...decoded.header, crit: ["enc"] };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, ...parts.slice(1)].join(".");

      expect(() => kit.decrypt(modifiedToken)).toThrow(/IANA-registered/);
    });

    test("should reject crit that is an empty array", () => {
      const { token } = kit.encrypt("data", {
        objectId: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03",
      });

      const decoded = JweKit.decode(token);
      const headerWithCrit = { ...decoded.header, crit: [] };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, ...parts.slice(1)].join(".");

      expect(() => kit.decrypt(modifiedToken)).toThrow(/empty/);
    });

    test("should accept token with empty critical array", () => {
      const { token } = kit.encrypt("data", {
        objectId: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03",
      });

      expect(() => kit.decrypt(token)).not.toThrow();
    });
  });

  describe("zip (compression) rejection", () => {
    test("rejects a JWE with zip: DEF to prevent compression oracle attacks", () => {
      const { token } = kit.encrypt("data", {
        objectId: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03",
      });

      // Splice zip: "DEF" into the protected header to simulate an attacker
      // attempting to compress-then-encrypt. Aegis must reject this outright.
      const decoded = JweKit.decode(token);
      const headerWithZip = { ...decoded.header, zip: "DEF" };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithZip))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, ...parts.slice(1)].join(".");

      expect(() => kit.decrypt(modifiedToken)).toThrow(
        "Compressed JWE payloads are not supported",
      );
    });
  });

  describe("tokenType round-trip", () => {
    test("should surface tokenType on decrypted header when signed with it", () => {
      const { token } = kit.encrypt("data", {
        objectId: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03",
        tokenType: "logout_token",
      });

      const decrypted = kit.decrypt(token);

      expect(decrypted.header.headerType).toBe("logout+jwe");
      expect(decrypted.header.tokenType).toBe("logout_token");
    });

    test("should leave tokenType undefined when not supplied", () => {
      const { token } = kit.encrypt("data", {
        objectId: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03",
      });

      const decrypted = kit.decrypt(token);

      expect(decrypted.header.headerType).toBe("JWE");
      expect(decrypted.header.tokenType).toBeUndefined();
    });
  });
});
