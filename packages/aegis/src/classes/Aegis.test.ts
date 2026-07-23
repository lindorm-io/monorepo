import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { TEST_EC_KEY_SIG, TEST_OKP_KEY_ENC } from "../__fixtures__/keys.js";
import { Aegis } from "./Aegis.js";
import { JwtKit } from "./JwtKit.js";
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
      header: { oid: "33100373-9769-4389-94dd-1b1d738f0fc4" },
    });

    expect(res).toEqual({
      format: "jwe",
      token: expect.any(String),
    });

    await expect(aegis.jwe.decrypt(res.token)).resolves.toEqual({
      header: {
        alg: "ECDH-ES",
        cty: "text/plain",
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
      payload: "data",
      token: res.token,
    });
  });

  test("should sign and verify jws", async () => {
    const res = await aegis.jws.sign("data", {
      header: { oid: "09172fab-dbff-40ef-bb86-94d9d4ed37dc" },
    });

    expect(res).toEqual({
      format: "jws",
      objectId: "09172fab-dbff-40ef-bb86-94d9d4ed37dc",
      token: expect.any(String),
    });

    await expect(aegis.jws.verify(res.token)).resolves.toEqual({
      header: {
        alg: "ES512",
        cty: "text/plain",
        jku: "https://test.lindorm.io/.well-known/jwks.json",
        kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
        oid: "09172fab-dbff-40ef-bb86-94d9d4ed37dc",
        typ: "JWS",
      },
      payload: "data",
      token: res.token,
    });
  });

  test("should sign and verify jwt", async () => {
    const res = await aegis.mint(
      "default",
      {
        expires: "1h",
        subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        tokenType: "test_token",
      },
      { sign: { header: { oid: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad" } } },
    );

    expect(res).toEqual({
      expiresAt: new Date("2024-01-01T09:00:00.000Z"),
      expiresIn: 3600,
      expiresOn: 1704099600,
      format: "jwt",
      objectId: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
      token: expect.any(String),
      tokenId: expect.any(String),
    });

    await expect(aegis.jwt.verify(res.token)).resolves.toEqual({
      // The raw namespace returns the NATIVE WIRE shape: both `.header` (wire-named
      // `alg`/`kid`/`typ`) and `.payload` (wire-keyed `sub`/`exp`) — NOT the domain
      // header/buckets. The domain-named header + claims are `aegis.verify`.
      header: {
        alg: "ES512",
        cty: "application/json",
        jku: "https://test.lindorm.io/.well-known/jwks.json",
        kid: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
        oid: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        typ: "application/test_token+jwt",
      },
      payload: {
        exp: 1704099600,
        iat: 1704096000,
        iss: "https://test.lindorm.io/",
        jti: expect.any(String),
        nbf: 1704096000,
        sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
      },
      token: res.token,
    });
  });

  test("should sign and verify jwe with jws", async () => {
    const jws = await aegis.jws.sign("data", {
      header: { oid: "09172fab-dbff-40ef-bb86-94d9d4ed37dc" },
    });

    const jwe = await aegis.jwe.encrypt(jws.token, {
      header: { oid: "33100373-9769-4389-94dd-1b1d738f0fc4" },
    });

    await expect(aegis.verify(jwe.token)).resolves.toEqual(
      expect.objectContaining({ format: "jwe", inner: "jws", raw: "data" }),
    );
  });

  test("should sign and verify jwe with jwt", async () => {
    const jwt = await aegis.mint("default", {
      expires: "1h",
      subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
      tokenType: "test_token",
    });

    const jwe = await aegis.jwe.encrypt(jwt.token, {
      header: { oid: "33100373-9769-4389-94dd-1b1d738f0fc4" },
    });

    await expect(aegis.verify(jwe.token)).resolves.toEqual(
      expect.objectContaining({
        format: "jwe",
        inner: "jwt",
        header: expect.objectContaining({
          tokenType: "test_token",
        }),
        claims: expect.objectContaining({
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        }),
      }),
    );
  });

  test("should sign and verify jws", async () => {
    const jws = await aegis.jws.sign("data", {
      header: { oid: "09172fab-dbff-40ef-bb86-94d9d4ed37dc" },
    });

    await expect(aegis.verify(jws.token)).resolves.toEqual(
      expect.objectContaining({ format: "jws", raw: "data" }),
    );
  });

  test("should sign and verify jwt", async () => {
    const jwt = await aegis.mint("default", {
      expires: "1h",
      subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
      tokenType: "test_token",
    });

    await expect(aegis.verify(jwt.token)).resolves.toEqual(
      expect.objectContaining({
        format: "jwt",
        header: expect.objectContaining({
          tokenType: "test_token",
        }),
        claims: expect.objectContaining({
          subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
        }),
      }),
    );
  });

  test("sign('default', …) re-imposes the historical floor (iss/iat/jti/nbf/exp)", async () => {
    const { token } = await aegis.mint("default", {
      expires: "1h",
      subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
      tokenType: "test_token",
    });

    const { payload } = JwtKit.decodeSegments(token);

    expect(payload).toEqual({
      exp: 1704099600,
      iat: 1704096000,
      iss: "https://test.lindorm.io/",
      jti: expect.any(String),
      nbf: 1704096000,
      sub: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
    });
  });

  test("sign('default', …) throws when a required claim is missing", async () => {
    await expect(
      aegis.mint("default", { tokenType: "test_token" } as never),
    ).rejects.toThrow();
  });

  test("sign({ payload }) signs a raw wire literal as a JWS", async () => {
    const res = await aegis.sign({ payload: "raw-data" });

    expect(res).toEqual({
      format: "jws",
      objectId: undefined,
      token: expect.any(String),
    });

    await expect(aegis.verify(res.token)).resolves.toEqual(
      expect.objectContaining({ format: "jws", raw: "raw-data" }),
    );
  });

  test("sign({ payload }) JSON-stringifies a plain object before signing", async () => {
    const res = await aegis.sign({ payload: { hello: "world" } });

    await expect(aegis.verify(res.token)).resolves.toEqual(
      expect.objectContaining({ format: "jws", raw: JSON.stringify({ hello: "world" }) }),
    );
  });

  test("registerProfile registers a custom profile usable by sign", async () => {
    aegis.registerProfile({
      name: "custom_aegis_profile",
      typ: { presence: "required", value: "custom+jwt" },
      required: ["subject"],
      forbidden: [],
      requiredWhen: [],
      atLeastOneOf: [],
      autoInject: ["issuedAt", "tokenId", "issuer"],
      issuer: "platform",
      lifetime: "1h",
      encryptable: false,
      validate: () => [],
    });

    const { token } = await aegis.mint("custom_aegis_profile", {
      subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
      tokenType: "test_token",
    });

    const { payload } = JwtKit.decodeSegments(token);

    expect(payload.sub).toBe("3f2ae79d-f1d1-556b-a8bc-305e6b2334ad");
    expect(payload.exp).toBe(1704099600);
    expect(payload.nbf).toBeUndefined();
  });
});
