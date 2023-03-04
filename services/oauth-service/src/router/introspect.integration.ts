import MockDate from "mockdate";
import request from "supertest";
import { configuration } from "../server/configuration";
import { server } from "../server/server";
import {
  createTestAccessToken,
  createTestClient,
  createTestClientSession,
  createTestRefreshToken,
} from "../fixtures/entity";
import {
  getTestAccessToken,
  getTestClientCredentials,
  setupIntegration,
  TEST_CLIENT_REPOSITORY,
  TEST_CLIENT_SESSION_REPOSITORY,
  TEST_OPAQUE_TOKEN_CACHE,
} from "../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/introspect", () => {
  beforeAll(setupIntegration);

  test("should introspect opaque access token", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());

    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        clientId: client.id,
      }),
    );

    const accessToken = await TEST_OPAQUE_TOKEN_CACHE.create(
      createTestAccessToken({
        clientSessionId: clientSession.id,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const response = await request(server.callback())
      .post("/introspect")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        token: accessToken.token,
        token_type_hint: "refresh_token",
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
      sub: expect.any(String),
      tid: expect.any(String),
      token_type: "access_token",
      username: expect.any(String),
    });
  });

  test("should introspect jwt access token", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());

    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        clientId: client.id,
      }),
    );

    const accessToken = await TEST_OPAQUE_TOKEN_CACHE.create(
      createTestAccessToken({
        clientSessionId: clientSession.id,
      }),
    );

    const jwt = getTestAccessToken({ id: accessToken.id });

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const response = await request(server.callback())
      .post("/introspect")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        token: jwt,
        token_type_hint: "refresh_token",
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
      sub: expect.any(String),
      tid: expect.any(String),
      token_type: "access_token",
      username: expect.any(String),
    });
  });

  test("should introspect opaque refresh token", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());

    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        clientId: client.id,
      }),
    );

    const refreshToken = await TEST_OPAQUE_TOKEN_CACHE.create(
      createTestRefreshToken({
        clientSessionId: clientSession.id,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const response = await request(server.callback())
      .post("/introspect")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        token: refreshToken.token,
        token_type_hint: "refresh_token",
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
      sub: expect.any(String),
      tid: expect.any(String),
      token_type: "refresh_token",
      username: expect.any(String),
    });
  });
});
