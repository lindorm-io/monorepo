import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { ClientSessionType } from "../../enum";
import { baseHash } from "@lindorm-io/core";
import { configuration } from "../../server/configuration";
import { getTestData, TEST_GET_USERINFO_RESPONSE } from "../../fixtures/data";
import { server } from "../../server/server";
import {
  createTestAuthorizationCode,
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
  createTestRefreshToken,
} from "../../fixtures/entity";
import {
  setupIntegration,
  TEST_ARGON,
  TEST_AUTHORIZATION_CODE_CACHE,
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_REPOSITORY,
  TEST_CLIENT_SESSION_REPOSITORY,
  TEST_OPAQUE_TOKEN_CACHE,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/token", () => {
  beforeAll(setupIntegration);

  nock("https://identity.test.lindorm.io")
    .get("/admin/claims")
    .query(true)
    .times(999)
    .reply(200, TEST_GET_USERINFO_RESPONSE);

  nock("https://test.client.lindorm.io")
    .get("/claims")
    .query(true)
    .times(999)
    .reply(200, { extraClientClaim: "extraClientClaim" });

  test("should resolve for authorization code grant type", async () => {
    const { code, codeChallenge, codeChallengeMethod, codeVerifier, nonce, state } = getTestData();

    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        secret: await TEST_ARGON.encrypt("secret"),
      }),
    );

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());

    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        audiences: [configuration.oauth.client_id, client.id],
        browserSessionId: browserSession.id,
        identityId: browserSession.identityId,
        clientId: client.id,
        scopes: client.allowed.scopes,
      }),
    );

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        browserSessionId: browserSession.id,
        clientId: client.id,
        clientSessionId: clientSession.id,
        code: {
          codeChallenge,
          codeChallengeMethod,
        },
        nonce,
        state,
      }),
    );

    await TEST_AUTHORIZATION_CODE_CACHE.create(
      createTestAuthorizationCode({
        authorizationSessionId: authorizationSession.id,
        code,
        expires: new Date("2021-01-01T08:01:00.000Z"),
      }),
    );

    const response = await request(server.callback())
      .post("/oauth2/token")
      .set("Authorization", `Basic ${baseHash(`${client.id}:secret`)}`)
      .send({
        code,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: authorizationSession.redirectUri,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      access_token: expect.any(String),
      expires_in: 99,
      id_token: expect.any(String),
      refresh_token: expect.any(String),
      scope: clientSession.scopes,
      token_type: "Bearer",
    });
  });

  test("should resolve for client credentials grant type", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        secret: await TEST_ARGON.encrypt("secret"),
      }),
    );

    const response = await request(server.callback())
      .post("/oauth2/token")
      .set("Authorization", `Basic ${baseHash(`${client.id}:secret`)}`)
      .send({
        grant_type: "client_credentials",
        scope: client.allowed.scopes.join(" "),
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      access_token: expect.any(String),
      expires_in: 60,
      scope: client.allowed.scopes,
      token_type: "Bearer",
    });
  });

  test("should resolve for refresh token grant type", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        secret: await TEST_ARGON.encrypt("secret"),
      }),
    );

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());

    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        clientId: client.id,
        browserSessionId: browserSession.id,
        identityId: browserSession.identityId,
        audiences: [configuration.oauth.client_id, client.id],
        scopes: client.allowed.scopes,
        type: ClientSessionType.REFRESH,
      }),
    );

    const refreshToken = await TEST_OPAQUE_TOKEN_CACHE.create(
      createTestRefreshToken({
        clientSessionId: clientSession.id,
      }),
    );

    const response = await request(server.callback())
      .post("/oauth2/token")
      .set("Authorization", `Basic ${baseHash(`${client.id}:secret`)}`)
      .send({
        grant_type: "refresh_token",
        refresh_token: refreshToken.token,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      access_token: expect.any(String),
      expires_in: 99,
      id_token: expect.any(String),
      refresh_token: expect.any(String),
      scope: client.allowed.scopes,
      token_type: "Bearer",
    });
  });
});
