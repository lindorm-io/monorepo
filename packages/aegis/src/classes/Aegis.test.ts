import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { TEST_EC_KEY_SIG, TEST_OKP_KEY_ENC } from "../__fixtures__/keys.js";
import { Aegis } from "./Aegis.js";
import { beforeEach, describe, expect, test } from "vitest";

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
        baseFormat: "JWE",
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
        baseFormat: "JWS",
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
    const res = await aegis.jwt.sign(
      {
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      },
      { objectId: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad" },
    );

    expect(res).toEqual({
      expiresAt: new Date("2024-01-01T09:00:00.000Z"),
      expiresIn: 3600,
      expiresOn: 1704099600,
      objectId: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
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
          typ: "test_token+jwt",
        },
        payload: {
          exp: 1704099600,
          iat: 1704096000,
          iss: "https://test.lindorm.io/",
          jti: expect.any(String),
          nbf: 1704096000,
          sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        },
        signature: expect.any(String),
      },
      header: {
        algorithm: "ES512",
        baseFormat: "JWT",
        contentType: "application/json",
        critical: [],
        headerType: "test_token+jwt",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        keyId: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
        objectId: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      },
      delegation: {
        actorChain: [],
        currentActor: undefined,
        isDelegated: false,
      },
      payload: {
        audience: [],
        authMethods: [],
        claims: {},
        entitlements: [],
        expiresAt: new Date("2024-01-01T09:00:00.000Z"),
        groups: [],
        issuedAt: new Date("2024-01-01T08:00:00.000Z"),
        issuer: "https://test.lindorm.io/",
        notBefore: new Date("2024-01-01T08:00:00.000Z"),
        permissions: [],
        roles: [],
        scope: [],
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenId: expect.any(String),
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
        header: expect.objectContaining({
          tokenType: "test_token",
        }),
        payload: expect.objectContaining({
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
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
        header: expect.objectContaining({
          tokenType: "test_token",
        }),
        payload: expect.objectContaining({
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        }),
      }),
    );
  });
});
