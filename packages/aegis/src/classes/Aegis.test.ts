import { Amphora, IAmphora } from "@lindorm/amphora";
import { ILogger, createMockLogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { TEST_EC_KEY_SIG, TEST_OKP_KEY_ENC } from "../__fixtures__/keys";
import { Aegis } from "./Aegis";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("Aegis", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ domain: "https://test.lindorm.io/", logger });
    aegis = new Aegis({ amphora, logger });

    await amphora.setup();

    amphora.add(TEST_EC_KEY_SIG);
    amphora.add(TEST_OKP_KEY_ENC);
  });

  test("should sign and verify cwe", async () => {
    const res = await aegis.cwe.encrypt("data", {
      objectId: "33100373-9769-4389-94dd-1b1d738f0fc4",
    });

    expect(res).toEqual({
      buffer: expect.any(Buffer),
      token: expect.any(String),
    });

    await expect(aegis.cwe.decrypt(res.token)).resolves.toEqual({
      decoded: {
        authTag: expect.any(Buffer),
        content: expect.any(Buffer),
        initialisationVector: expect.any(Buffer),
        protected: {
          alg: "A256GCM",
          cty: "text/plain",
          typ: "application/cose; cose-type=cose-encrypt",
        },
        protectedCbor: expect.any(Buffer),
        recipient: {
          initialisationVector: undefined,
          publicEncryptionKey: null,
          unprotected: {
            alg: "ECDH-ES",
            epk: {
              crv: "X25519",
              kty: "OKP",
              x: expect.any(String),
            },
            kid: "035f7f00-8101-5387-a935-e92f57347309",
          },
        },
        unprotected: {
          iv: expect.any(Buffer),
          oid: "33100373-9769-4389-94dd-1b1d738f0fc4",
        },
      },
      header: {
        algorithm: "A256GCM",
        contentType: "text/plain",
        critical: [],
        headerType: "application/cose; cose-type=cose-encrypt",
        keyId: "035f7f00-8101-5387-a935-e92f57347309",
        objectId: "33100373-9769-4389-94dd-1b1d738f0fc4",
        publicEncryptionJwk: {
          crv: "X25519",
          kty: "OKP",
          x: expect.any(String),
        },
      },
      payload: "data",
      token: res.token,
    });
  });

  test("should sign and verify cws", async () => {
    const res = await aegis.cws.sign("data", {
      objectId: "09172fab-dbff-40ef-bb86-94d9d4ed37dc",
    });

    expect(res).toEqual({
      buffer: expect.any(Buffer),
      objectId: "09172fab-dbff-40ef-bb86-94d9d4ed37dc",
      token: expect.any(String),
    });

    await expect(aegis.cws.verify(res.token)).resolves.toEqual({
      decoded: {
        protected: {
          alg: "ES512",
          cty: "text/plain; charset=utf-8",
          typ: "application/cose; cose-type=cose-sign",
        },
        unprotected: {
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
          oid: "09172fab-dbff-40ef-bb86-94d9d4ed37dc",
        },
        payload: Buffer.from("data"),
        signature: expect.any(Buffer),
      },
      header: {
        algorithm: "ES512",
        contentType: "text/plain; charset=utf-8",
        critical: [],
        headerType: "application/cose; cose-type=cose-sign",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        keyId: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
        objectId: "09172fab-dbff-40ef-bb86-94d9d4ed37dc",
      },
      payload: "data",
      token: res.token,
    });
  });

  test("should sign and verify cwt", async () => {
    const res = await aegis.cwt.sign({
      expires: "1h",
      subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
      tokenType: "test_token",
    });

    expect(res).toEqual({
      buffer: expect.any(Buffer),
      expiresAt: new Date("2024-01-01T09:00:00.000Z"),
      expiresIn: 3600,
      expiresOn: 1704099600,
      objectId: expect.any(String),
      token: expect.any(String),
      tokenId: expect.any(String),
    });

    await expect(aegis.cwt.verify(res.token)).resolves.toEqual({
      decoded: {
        protected: {
          alg: "ES512",
          cty: "application/json",
          typ: "application/cwt",
        },
        unprotected: {
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
          oid: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        },
        payload: {
          exp: 1704099600,
          iat: 1704096000,
          iss: "https://test.lindorm.io/",
          jti: expect.any(String),
          nbf: 1704096000,
          sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          token_type: "test_token",
        },
        signature: expect.any(Buffer),
      },
      header: {
        algorithm: "ES512",
        contentType: "application/json",
        critical: [],
        headerType: "application/cwt",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        keyId: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
        objectId: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
      },
      payload: {
        audience: [],
        authMethods: [],
        claims: {},
        expiresAt: new Date("2024-01-01T09:00:00.000Z"),
        issuedAt: new Date("2024-01-01T08:00:00.000Z"),
        issuer: "https://test.lindorm.io/",
        notBefore: new Date("2024-01-01T08:00:00.000Z"),
        permissions: [],
        roles: [],
        scope: [],
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenId: expect.any(String),
        tokenType: "test_token",
      },
      token: res.token,
    });
  });

  test("should sign and verify jwe", async () => {
    const res = await aegis.jwe.encrypt("data", {
      objectId: "33100373-9769-4389-94dd-1b1d738f0fc4",
    });

    expect(res).toEqual({
      token: expect.any(String),
    });

    await expect(aegis.jwe.decrypt(res.token)).resolves.toEqual({
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
          oid: "33100373-9769-4389-94dd-1b1d738f0fc4",
          typ: "JWE",
        },
        initialisationVector: expect.any(String),
        publicEncryptionKey: undefined,
      },
      header: {
        algorithm: "ECDH-ES",
        contentType: "text/plain; charset=utf-8",
        critical: [],
        encryption: "A256GCM",
        headerType: "JWE",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        keyId: "035f7f00-8101-5387-a935-e92f57347309",
        objectId: "33100373-9769-4389-94dd-1b1d738f0fc4",
        publicEncryptionJwk: {
          crv: "X25519",
          kty: "OKP",
          x: expect.any(String),
        },
      },
      payload: "data",
      token: res.token,
    });
  });

  test("should sign and verify jws", async () => {
    const res = await aegis.jws.sign("data", {
      objectId: "09172fab-dbff-40ef-bb86-94d9d4ed37dc",
    });

    expect(res).toEqual({
      objectId: "09172fab-dbff-40ef-bb86-94d9d4ed37dc",
      token: expect.any(String),
    });

    await expect(aegis.jws.verify(res.token)).resolves.toEqual({
      decoded: {
        header: {
          alg: "ES512",
          cty: "text/plain; charset=utf-8",
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
          oid: "09172fab-dbff-40ef-bb86-94d9d4ed37dc",
          typ: "JWS",
        },
        payload: "data",
        signature: expect.any(String),
      },
      header: {
        algorithm: "ES512",
        contentType: "text/plain; charset=utf-8",
        critical: [],
        headerType: "JWS",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        keyId: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
        objectId: "09172fab-dbff-40ef-bb86-94d9d4ed37dc",
      },
      payload: "data",
      token: res.token,
    });
  });

  test("should sign and verify jwt", async () => {
    const res = await aegis.jwt.sign({
      expires: "1h",
      subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
      tokenType: "test_token",
    });

    expect(res).toEqual({
      expiresAt: new Date("2024-01-01T09:00:00.000Z"),
      expiresIn: 3600,
      expiresOn: 1704099600,
      objectId: expect.any(String),
      token: expect.any(String),
      tokenId: expect.any(String),
    });

    await expect(aegis.jwt.verify(res.token)).resolves.toEqual({
      decoded: {
        header: {
          alg: "ES512",
          cty: "application/json",
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
          oid: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          typ: "JWT",
        },
        payload: {
          exp: 1704099600,
          iat: 1704096000,
          iss: "https://test.lindorm.io/",
          jti: expect.any(String),
          nbf: 1704096000,
          sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          token_type: "test_token",
        },
        signature: expect.any(String),
      },
      header: {
        algorithm: "ES512",
        contentType: "application/json",
        critical: [],
        headerType: "JWT",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        keyId: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
        objectId: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
      },
      payload: {
        audience: [],
        authMethods: [],
        claims: {},
        expiresAt: new Date("2024-01-01T09:00:00.000Z"),
        issuedAt: new Date("2024-01-01T08:00:00.000Z"),
        issuer: "https://test.lindorm.io/",
        notBefore: new Date("2024-01-01T08:00:00.000Z"),
        permissions: [],
        roles: [],
        scope: [],
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenId: expect.any(String),
        tokenType: "test_token",
      },
      token: res.token,
    });
  });

  test("should sign and verify jwe with jws", async () => {
    const jws = await aegis.jws.sign("data", {
      objectId: "09172fab-dbff-40ef-bb86-94d9d4ed37dc",
    });

    const jwe = await aegis.jwe.encrypt(jws.token, {
      objectId: "33100373-9769-4389-94dd-1b1d738f0fc4",
    });

    await expect(aegis.verify(jwe.token)).resolves.toEqual(
      expect.objectContaining({ payload: "data" }),
    );
  });

  test("should sign and verify jwe with jwt", async () => {
    const jwt = await aegis.jwt.sign({
      expires: "1h",
      subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
      tokenType: "test_token",
    });

    const jwe = await aegis.jwe.encrypt(jwt.token, {
      objectId: "33100373-9769-4389-94dd-1b1d738f0fc4",
    });

    await expect(aegis.verify(jwe.token)).resolves.toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          tokenType: "test_token",
        }),
      }),
    );
  });

  test("should sign and verify jws", async () => {
    const jws = await aegis.jws.sign("data", {
      objectId: "09172fab-dbff-40ef-bb86-94d9d4ed37dc",
    });

    await expect(aegis.verify(jws.token)).resolves.toEqual(
      expect.objectContaining({ payload: "data" }),
    );
  });

  test("should sign and verify jwt", async () => {
    const jwt = await aegis.jwt.sign({
      expires: "1h",
      subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
      tokenType: "test_token",
    });

    await expect(aegis.verify(jwt.token)).resolves.toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
          tokenType: "test_token",
        }),
      }),
    );
  });
});
