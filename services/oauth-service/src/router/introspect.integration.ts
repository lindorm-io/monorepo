import { baseHash } from "@lindorm-io/core";
import { createOpaqueToken } from "@lindorm-io/jwt";
import MockDate from "mockdate";
import request from "supertest";
import {
  createTestAccessToken,
  createTestClient,
  createTestClientSession,
  createTestRefreshToken,
} from "../fixtures/entity";
import {
  TEST_ARGON,
  TEST_CLIENT_REPOSITORY,
  TEST_CLIENT_SESSION_REPOSITORY,
  TEST_OPAQUE_TOKEN_CACHE,
  getTestAccessToken,
  setupIntegration,
} from "../fixtures/integration";
import { server } from "../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/introspect", () => {
  beforeAll(setupIntegration);

  test("should introspect opaque access token", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        secret: await TEST_ARGON.encrypt("secret"),
      }),
    );

    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        clientId: client.id,
      }),
    );

    const opaqueToken = createOpaqueToken();
    await TEST_OPAQUE_TOKEN_CACHE.create(
      createTestAccessToken({
        id: opaqueToken.id,
        clientSessionId: clientSession.id,
        signature: opaqueToken.signature,
      }),
    );

    const response = await request(server.callback())
      .post("/introspect")
      .set("Authorization", `Basic ${baseHash(`${client.id}:secret`)}`)
      .send({
        token: opaqueToken.token,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      aal: 2,
      acr: "loa_2",
      active: true,
      amr: ["email", "phone"],
      aud: [
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
      ],
      auth_time: 1609487940,
      azp: expect.any(String),
      client_id: expect.any(String),
      exp: 1609574400,
      iat: 1609488000,
      iss: "https://oauth.test.lindorm.io",
      jti: expect.any(String),
      loa: 2,
      nbf: 1609488000,
      scope: "openid profile",
      sid: expect.any(String),
      sih: "client_session",
      sub: expect.any(String),
      suh: "identity",
      tid: expect.any(String),
      token_type: "access_token",
      username: expect.any(String),
    });
  });

  test("should introspect jwt access token", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        secret: await TEST_ARGON.encrypt("secret"),
      }),
    );

    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        clientId: client.id,
      }),
    );

    const opaqueToken = createOpaqueToken();
    const accessToken = await TEST_OPAQUE_TOKEN_CACHE.create(
      createTestAccessToken({
        id: opaqueToken.id,
        clientSessionId: clientSession.id,
        signature: opaqueToken.signature,
      }),
    );

    const jwt = getTestAccessToken({ id: accessToken.id });

    const response = await request(server.callback())
      .post("/introspect")
      .set("Authorization", `Basic ${baseHash(`${client.id}:secret`)}`)
      .send({
        token: jwt,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      aal: 2,
      acr: "loa_2",
      active: true,
      amr: ["email", "phone"],
      aud: [
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
      ],
      auth_time: 1609487940,
      azp: expect.any(String),
      client_id: expect.any(String),
      exp: 1609574400,
      iat: 1609488000,
      iss: "https://oauth.test.lindorm.io",
      jti: expect.any(String),
      loa: 2,
      nbf: 1609488000,
      scope: "openid profile",
      sid: expect.any(String),
      sih: "client_session",
      sub: expect.any(String),
      suh: "identity",
      tid: expect.any(String),
      token_type: "access_token",
      username: expect.any(String),
    });
  });

  test("should introspect opaque refresh token", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        secret: await TEST_ARGON.encrypt("secret"),
      }),
    );

    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        clientId: client.id,
      }),
    );

    const opaqueToken = createOpaqueToken();
    await TEST_OPAQUE_TOKEN_CACHE.create(
      createTestRefreshToken({
        id: opaqueToken.id,
        clientSessionId: clientSession.id,
        signature: opaqueToken.signature,
      }),
    );

    const response = await request(server.callback())
      .post("/introspect")
      .set("Authorization", `Basic ${baseHash(`${client.id}:secret`)}`)
      .send({
        token: opaqueToken.token,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      aal: 2,
      acr: "loa_2",
      active: true,
      amr: ["email", "phone"],
      aud: [
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
      ],
      auth_time: 1609487940,
      azp: expect.any(String),
      client_id: expect.any(String),
      exp: 1609574400,
      iat: 1609488000,
      iss: "https://oauth.test.lindorm.io",
      jti: expect.any(String),
      loa: 2,
      nbf: 1609488000,
      scope: "openid profile",
      sid: expect.any(String),
      sih: "client_session",
      sub: expect.any(String),
      suh: "identity",
      tid: expect.any(String),
      token_type: "refresh_token",
      username: expect.any(String),
    });
  });
});
