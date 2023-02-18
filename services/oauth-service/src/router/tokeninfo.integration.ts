import MockDate from "mockdate";
import request from "supertest";
import { configuration } from "../server/configuration";
import { randomUUID } from "crypto";
import { server } from "../server/server";
import {
  createTestBrowserSession,
  createTestClient,
  createTestRefreshSession,
} from "../fixtures/entity";
import {
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_REPOSITORY,
  TEST_REFRESH_SESSION_REPOSITORY,
  getTestAccessToken,
  getTestClientCredentials,
  getTestRefreshToken,
  setupIntegration,
} from "../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/tokeninfo", () => {
  beforeAll(setupIntegration);

  test("POST / - ACCESS", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());

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
      session: browserSession.id,
      subject: "7914aeb7-76bc-4341-8b1e-8392528b6fac",
      tenant: "980664cf-321a-4a5c-af47-8155ec49c6a6",
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
      acr: [],
      active: true,
      amr: [],
      aud: ["6ea68f3d-e31e-4882-85a5-0a617f431fdd", client.id],
      auth_time: 1609488000,
      azp: null,
      client_id: client.id,
      exp: 1609488010,
      iat: 1609488000,
      iss: "https://oauth.test.lindorm.io",
      jti: tokenId,
      loa: 4,
      nbf: 1609488000,
      scope: [
        "address",
        "email",
        "offline_access",
        "openid",
        "phone",
        "profile",
        "accessibility",
        "connected_providers",
        "national_identity_number",
        "public",
        "social_security_number",
        "username",
      ],
      sid: browserSession.id,
      sub: "7914aeb7-76bc-4341-8b1e-8392528b6fac",
      tid: "980664cf-321a-4a5c-af47-8155ec49c6a6",
      token_type: "access_token",
      username: null,
    });
  });

  test("POST / - REFRESH", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());
    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const tokenId = randomUUID();

    const refreshSession = await TEST_REFRESH_SESSION_REPOSITORY.create(
      createTestRefreshSession({
        clientId: client.id,
        refreshTokenId: tokenId,
      }),
    );

    const token = getTestRefreshToken({
      id: tokenId,
      audiences: [configuration.oauth.client_id, client.id],
      tenant: "980664cf-321a-4a5c-af47-8155ec49c6a6",
      subject: "84e08eb5-466c-4097-9bb7-d09c43f7cbe0",
      session: refreshSession.id,
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
      aal: 0,
      acr: [],
      amr: [],
      aud: ["6ea68f3d-e31e-4882-85a5-0a617f431fdd", client.id],
      auth_time: null,
      azp: null,
      client_id: client.id,
      exp: 1609488010,
      iat: 1609488000,
      iss: "https://oauth.test.lindorm.io",
      jti: tokenId,
      loa: 0,
      nbf: 1609488000,
      scope: [],
      sid: refreshSession.id,
      sub: "84e08eb5-466c-4097-9bb7-d09c43f7cbe0",
      tid: "980664cf-321a-4a5c-af47-8155ec49c6a6",
      token_type: "refresh_token",
      username: null,
    });
  });
});
