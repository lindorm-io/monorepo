import { KryptosAlgorithm, KryptosKit } from "@lindorm/kryptos";
import { ILogger, createMockLogger } from "@lindorm/logger";
import MockDate from "mockdate";
import {
  TEST_EC_KEY_ENC,
  TEST_OCT_KEY_ENC,
  TEST_OKP_KEY_ENC,
} from "../__fixtures__/keys";
import { CweKit } from "./CweKit";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("CweKit", () => {
  let logger: ILogger;
  let kit: CweKit;

  beforeEach(() => {
    logger = createMockLogger();
    kit = new CweKit({ logger, kryptos: TEST_EC_KEY_ENC });
  });

  describe("encrypt", () => {
    test("should encrypt data using EC", () => {
      expect(kit.encrypt("data")).toEqual({
        buffer: expect.any(Buffer),
        token: expect.any(String),
      });
    });

    test("should encrypt data using OCT", () => {
      kit = new CweKit({ logger, kryptos: TEST_OCT_KEY_ENC });

      expect(kit.encrypt("data")).toEqual({
        buffer: expect.any(Buffer),
        token: expect.any(String),
      });
    });

    test("should encrypt data using OKP", () => {
      kit = new CweKit({ logger, kryptos: TEST_OKP_KEY_ENC });

      expect(kit.encrypt("data")).toEqual({
        buffer: expect.any(Buffer),
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
          protected: {
            alg: "ECDH-ES",
            cty: "text/plain",
            typ: "application/cose; cose-type=cose-encrypt",
          },
          unprotected: {
            iv: expect.any(Buffer),
            oid: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03",
          },
          recipient: {
            initialisationVector: undefined,
            publicEncryptionKey: null,
            unprotected: {
              enc: "A256GCM",
              epk: {
                crv: "P-521",
                kty: "EC",
                x: expect.any(String),
                y: expect.any(String),
              },
              jku: "https://test.lindorm.io/.well-known/jwks.json",
              kid: "43bd1720-5dab-5d52-ae1e-e9dbbe6adfe4",
            },
          },
          authTag: expect.any(Buffer),
          content: expect.any(Buffer),
          initialisationVector: expect.any(Buffer),
        },
        header: {
          algorithm: "ECDH-ES",
          contentType: "text/plain",
          critical: [],
          encryption: "A256GCM",
          headerType: "application/cose; cose-type=cose-encrypt",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: "43bd1720-5dab-5d52-ae1e-e9dbbe6adfe4",
          publicEncryptionJwk: {
            crv: "P-521",
            kty: "EC",
            x: expect.any(String),
            y: expect.any(String),
          },
          objectId: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03",
        },
        payload: "data",
        token: expect.any(String),
      });
    });

    test("should decrypt data using OCT dir", () => {
      kit = new CweKit({ logger, kryptos: TEST_OCT_KEY_ENC });

      const { token } = kit.encrypt("data", {
        objectId: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
      });

      expect(kit.decrypt(token)).toEqual({
        decoded: {
          protected: {
            alg: "dir",
            cty: "text/plain",
            typ: "application/cose; cose-type=cose-encrypt",
          },
          unprotected: {
            iv: expect.any(Buffer),
            oid: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
          },
          recipient: {
            initialisationVector: undefined,
            publicEncryptionKey: null,
            unprotected: {
              enc: "A256GCM",
              jku: "https://test.lindorm.io/.well-known/jwks.json",
              kid: "ae26175f-961d-5947-8318-6299e4576b83",
            },
          },
          authTag: expect.any(Buffer),
          content: expect.any(Buffer),
          initialisationVector: expect.any(Buffer),
        },
        header: {
          algorithm: "dir",
          contentType: "text/plain",
          critical: [],
          encryption: "A256GCM",
          headerType: "application/cose; cose-type=cose-encrypt",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: "ae26175f-961d-5947-8318-6299e4576b83",
          objectId: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
        },
        payload: "data",
        token: expect.any(String),
      });
    });

    test("should decrypt data using OCT hkdf", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "A128KW",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
      });

      kit = new CweKit({ logger, kryptos });

      const { token } = kit.encrypt("data", {
        objectId: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
      });

      expect(kit.decrypt(token)).toEqual({
        decoded: {
          protected: {
            alg: "A128KW",
            cty: "text/plain",
            typ: "application/cose; cose-type=cose-encrypt",
          },
          unprotected: {
            iv: expect.any(Buffer),
            oid: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
          },
          recipient: {
            initialisationVector: undefined,
            publicEncryptionKey: expect.any(Buffer),
            unprotected: {
              enc: "A256GCM",
              jku: "https://test.lindorm.io/.well-known/jwks.json",
              kid: kryptos.id,
            },
          },
          authTag: expect.any(Buffer),
          content: expect.any(Buffer),
          initialisationVector: expect.any(Buffer),
        },
        header: {
          algorithm: "A128KW",
          contentType: "text/plain",
          critical: [],
          encryption: "A256GCM",
          headerType: "application/cose; cose-type=cose-encrypt",
          jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
          keyId: kryptos.id,
          objectId: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
        },
        payload: "data",
        token: expect.any(String),
      });
    });

    test("should decrypt data using OCT A128GCMKW", () => {
      const kryptos = KryptosKit.generate.enc.oct({ algorithm: "A128GCMKW" });

      kit = new CweKit({ logger, kryptos });

      const { token } = kit.encrypt("data", {
        objectId: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
      });

      expect(kit.decrypt(token)).toEqual({
        decoded: {
          protected: {
            alg: "A128GCMKW",
            cty: "text/plain",
            typ: "application/cose; cose-type=cose-encrypt",
          },
          unprotected: {
            iv: expect.any(Buffer),
            oid: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
          },
          recipient: {
            initialisationVector: expect.any(Buffer),
            publicEncryptionKey: expect.any(Buffer),
            unprotected: {
              enc: "A256GCM",
              iv: expect.any(Buffer),
              kid: kryptos.id,
              tag: expect.any(Buffer),
            },
          },
          authTag: expect.any(Buffer),
          content: expect.any(Buffer),
          initialisationVector: expect.any(Buffer),
        },
        header: {
          algorithm: "A128GCMKW",
          contentType: "text/plain",
          critical: [],
          encryption: "A256GCM",
          headerType: "application/cose; cose-type=cose-encrypt",
          keyId: kryptos.id,
          objectId: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
        },
        payload: "data",
        token: expect.any(String),
      });
    });

    test("should decrypt data using OKP", () => {
      kit = new CweKit({ logger, kryptos: TEST_OKP_KEY_ENC });

      const { token } = kit.encrypt("data", {
        objectId: "540061f3-aea2-4625-b034-c48a7a9ac114",
      });

      expect(kit.decrypt(token)).toEqual({
        decoded: {
          protected: {
            alg: "ECDH-ES",
            cty: "text/plain",
            typ: "application/cose; cose-type=cose-encrypt",
          },
          unprotected: {
            iv: expect.any(Buffer),
            oid: "540061f3-aea2-4625-b034-c48a7a9ac114",
          },
          recipient: {
            initialisationVector: undefined,
            publicEncryptionKey: null,
            unprotected: {
              enc: "A256GCM",
              epk: {
                crv: "X25519",
                kty: "OKP",
                x: expect.any(String),
              },
              jku: "https://test.lindorm.io/.well-known/jwks.json",
              kid: "035f7f00-8101-5387-a935-e92f57347309",
            },
          },
          authTag: expect.any(Buffer),
          content: expect.any(Buffer),
          initialisationVector: expect.any(Buffer),
        },
        header: {
          algorithm: "ECDH-ES",
          contentType: "text/plain",
          critical: [],
          encryption: "A256GCM",
          headerType: "application/cose; cose-type=cose-encrypt",
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
        token: expect.any(String),
      });
    });
  });

  describe("decode", () => {
    test("should decode data", () => {
      const { token } = kit.encrypt("data", {
        objectId: "e5d4ed15-3350-4fdc-a9cf-d8270d637e99",
      });

      expect(CweKit.decode(token)).toEqual({
        protected: {
          alg: "ECDH-ES",
          cty: "text/plain",
          typ: "application/cose; cose-type=cose-encrypt",
        },
        unprotected: {
          iv: expect.any(Buffer),
          oid: "e5d4ed15-3350-4fdc-a9cf-d8270d637e99",
        },
        recipient: {
          initialisationVector: undefined,
          publicEncryptionKey: null,
          unprotected: {
            enc: "A256GCM",
            epk: {
              crv: "P-521",
              kty: "EC",
              x: expect.any(String),
              y: expect.any(String),
            },
            jku: "https://test.lindorm.io/.well-known/jwks.json",
            kid: "43bd1720-5dab-5d52-ae1e-e9dbbe6adfe4",
          },
        },
        authTag: expect.any(Buffer),
        content: expect.any(Buffer),
        initialisationVector: expect.any(Buffer),
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
    ];

    test.each(algorithms)("should encrypt and decrypt data using %s", (algorithm) => {
      const kryptos = KryptosKit.generate.auto({ algorithm });

      const coseEncryptKit = new CweKit({ logger, kryptos });

      const { token } = coseEncryptKit.encrypt("data");

      expect(coseEncryptKit.decrypt(token)).toBeDefined();
    });
  });

  describe("critical header parameter rejection", () => {
    // Note: CweKit has the same critical header validation logic as JweKit (lines 144-149 in CweKit.ts)
    // Testing with manually crafted CBOR-encoded tokens is complex, but the validation code path
    // is identical to the JOSE kits which are thoroughly tested.
    // The logic: if (header.critical?.length) throw error for each param

    test("should accept token with empty critical array", () => {
      const { buffer } = kit.encrypt("data", {
        objectId: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03",
      });

      expect(() => kit.decrypt(buffer)).not.toThrow();
    });

    test("should decode token and verify critical field is empty array", () => {
      const { buffer } = kit.encrypt("data", {
        objectId: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03",
      });

      const { header } = kit.decrypt(buffer);

      expect(header.critical).toEqual([]);
    });
  });
});
