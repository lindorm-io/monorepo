import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { SessionHint } from "../../enum";
import { getTestData, TEST_GET_USERINFO_RESPONSE } from "../../fixtures/data";
import { baseHash } from "@lindorm-io/core";
import { configuration } from "../../server/configuration";
import { randomUUID } from "crypto";
import { server } from "../../server/server";
import {
  createTestAuthorizationCode,
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestRefreshSession,
} from "../../fixtures/entity";
import {
  getTestRefreshToken,
  setupIntegration,
  TEST_ARGON,
  TEST_AUTHORIZATION_CODE_CACHE,
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_REPOSITORY,
  TEST_REFRESH_SESSION_REPOSITORY,
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

    const refreshSession = await TEST_REFRESH_SESSION_REPOSITORY.create(
      createTestRefreshSession({
        audiences: [configuration.oauth.client_id, client.id],
        browserSessionId: browserSession.id,
        identityId: browserSession.identityId,
        clientId: client.id,
        scopes: client.allowed.scopes,
      }),
    );

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        accessSessionId: null,
        browserSessionId: browserSession.id,
        clientId: client.id,
        code: {
          codeChallenge,
          codeChallengeMethod,
        },
        nonce,
        refreshSessionId: refreshSession.id,
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
      scope: refreshSession.scopes,
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

    const refreshSession = await TEST_REFRESH_SESSION_REPOSITORY.create(
      createTestRefreshSession({
        clientId: client.id,
        browserSessionId: browserSession.id,
        identityId: browserSession.identityId,
        refreshTokenId: randomUUID(),
        audiences: [configuration.oauth.client_id, client.id],
        scopes: client.allowed.scopes,
      }),
    );

    const refreshToken = getTestRefreshToken({
      id: refreshSession.refreshTokenId,
      audiences: [configuration.oauth.client_id, client.id],
      client: client.id,
      session: refreshSession.id,
      sessionHint: SessionHint.REFRESH,
      subject: browserSession.identityId,
      tenant: client.tenantId,
    });

    const response = await request(server.callback())
      .post("/oauth2/token")
      .set("Authorization", `Basic ${baseHash(`${client.id}:secret`)}`)
      .send({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
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
