import { ILogger, createMockLogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { TEST_EC_KEY_SIG, TEST_OKP_KEY_ENC } from "../__fixtures__/keys";
import { Aegis } from "./Aegis";
import { AegisVault } from "./AegisVault";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("Aegis", () => {
  let logger: ILogger;
  let vault: AegisVault;
  let kit: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    vault = new AegisVault({ logger });
    kit = new Aegis({ issuer: "https://test.lindorm.io/", logger, vault });

    await vault.setup();

    vault.add(TEST_EC_KEY_SIG);
    vault.add(TEST_OKP_KEY_ENC);
  });

  test("should sign and verify jwe", async () => {
    const res = await kit.jwe.encrypt("data", {
      objectId: "33100373-9769-4389-94dd-1b1d738f0fc4",
    });

    expect(res).toEqual({
      token: expect.any(String),
    });

    await expect(kit.jwe.decrypt(res.token)).resolves.toEqual({
      __jwe: {
        authTag: expect.any(String),
        content: expect.any(String),
        header: {
          alg: "ECDH-ES",
          crit: ["alg", "enc", "epk", "hkdf_salt"],
          cty: "text/plain",
          enc: "A256GCM",
          epk: {
            crv: "X25519",
            kty: "OKP",
            x: expect.any(String),
          },
          hkdf_salt: expect.any(String),
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
        contentType: "text/plain",
        critical: ["algorithm", "encryption", "publicEncryptionJwk", "hkdfSalt"],
        encryption: "A256GCM",
        headerType: "JWE",
        hkdfSalt: expect.any(String),
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
    });
  });

  test("should sign jws", async () => {
    const res = await kit.jws.sign("data", {
      objectId: "09172fab-dbff-40ef-bb86-94d9d4ed37dc",
    });

    expect(res).toEqual({
      objectId: "09172fab-dbff-40ef-bb86-94d9d4ed37dc",
      token: expect.any(String),
    });

    await expect(kit.jws.verify(res.token)).resolves.toEqual({
      __jws: {
        header: {
          alg: "ES512",
          cty: "text/plain",
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
        contentType: "text/plain",
        critical: [],
        headerType: "JWS",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        keyId: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
        objectId: "09172fab-dbff-40ef-bb86-94d9d4ed37dc",
      },
      payload: "data",
    });
  });

  test("should sign jwt", async () => {
    const res = await kit.jwt.sign({
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

    await expect(kit.jwt.verify(res.token)).resolves.toEqual({
      __jwt: {
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
    });
  });
});
