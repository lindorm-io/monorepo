import MockDate from "mockdate";
import request from "supertest";
import { Scope } from "../common";
import { configuration } from "../server/configuration";
import { randomUUID } from "crypto";
import { server } from "../server/server";
import {
  createTestBrowserSession,
  createTestClient,
  createTestRefreshSession,
} from "../fixtures/entity";
import {
  TEST_CLIENT_CACHE,
  getTestClientCredentials,
  setupIntegration,
  getTestRefreshToken,
  getTestAccessToken,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_REFRESH_SESSION_REPOSITORY,
} from "../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/tokeninfo", () => {
  beforeAll(setupIntegration);

  test("POST / - ACCESS", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      createTestBrowserSession({
        identityId: randomUUID(),
      }),
    );

    const tokenId = randomUUID();
    const token = getTestAccessToken({
      id: tokenId,
      audiences: [configuration.oauth.client_id, client.id],
      sessionId: browserSession.id,
      subject: "7914aeb7-76bc-4341-8b1e-8392528b6fac",
    });

    const response = await request(server.callback())
      .post("/tokeninfo")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        token,
        token_type_hint: "access_token",
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      aal: 4,
      active: true,
      aud: ["6ea68f3d-e31e-4882-85a5-0a617f431fdd", client.id],
      client_id: client.id,
      exp: 1609488010,
      iat: 1609488000,
      iss: "https://oauth.test.lindorm.io",
      jti: tokenId,
      loa: 4,
      nbf: 1609488000,
      scope: Object.values(Scope),
      sid: browserSession.id,
      sub: "7914aeb7-76bc-4341-8b1e-8392528b6fac",
      token_type: "access_token",
    });
  });

  test("POST / - REFRESH", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());
    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const tokenId = randomUUID();

    const refreshSession = await TEST_REFRESH_SESSION_REPOSITORY.create(
      createTestRefreshSession({
        clientId: client.id,
        tokenId,
      }),
    );

    const token = getTestRefreshToken({
      id: tokenId,
      audiences: [configuration.oauth.client_id, client.id],
      sessionId: refreshSession.id,
    });

    const response = await request(server.callback())
      .post("/tokeninfo")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        token,
        token_type_hint: "refresh_token",
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      active: true,
      aud: ["6ea68f3d-e31e-4882-85a5-0a617f431fdd", client.id],
      client_id: client.id,
      exp: 1609488010,
      iat: 1609488000,
      iss: "https://oauth.test.lindorm.io",
      jti: tokenId,
      nbf: 1609488000,
      scope: [],
      sid: refreshSession.id,
      sub: "4634b8bf-a17e-4788-84d7-3054d2e522cb",
      token_type: "refresh_token",
    });
  });
});
