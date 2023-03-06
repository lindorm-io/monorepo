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
  getTestClientCredentials,
  setupIntegration,
  TEST_CLIENT_REPOSITORY,
  TEST_CLIENT_SESSION_REPOSITORY,
  TEST_OPAQUE_TOKEN_CACHE,
} from "../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/exchange", () => {
  beforeAll(setupIntegration);

  test("should exchange opaque access token", async () => {
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
      .post("/exchange")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        token: accessToken.token,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      expires_in: 86400,
      jwt: expect.any(String),
    });
  });

  test("should exchange opaque refresh token", async () => {
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
      .post("/exchange")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        token: refreshToken.token,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      expires_in: 86400,
      jwt: expect.any(String),
    });
  });
});
