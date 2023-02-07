import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { TEST_GET_USERINFO_RESPONSE, getTestData } from "../../fixtures/data";
import { configuration } from "../../server/configuration";
import { randomUUID } from "crypto";
import { server } from "../../server/server";
import {
  createTestAuthorizationSession,
  createTestClient,
  createTestConsentSession,
  createTestBrowserSession,
  createTestRefreshSession,
  createTestAuthorizationCode,
} from "../../fixtures/entity";
import {
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_CLIENT_CACHE,
  TEST_CONSENT_SESSION_REPOSITORY,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_ARGON,
  TEST_REFRESH_SESSION_REPOSITORY,
  getTestRefreshToken,
  setupIntegration,
  TEST_AUTHORIZATION_CODE_CACHE,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/token", () => {
  beforeAll(setupIntegration);

  nock("https://identity.test.lindorm.io")
    .get("/userinfo")
    .times(999)
    .reply(200, TEST_GET_USERINFO_RESPONSE);

  test("should resolve for authorization code grant type", async () => {
    const { code, codeChallenge, codeChallengeMethod, codeVerifier, nonce, state } = getTestData();

    const client = await TEST_CLIENT_CACHE.create(
      createTestClient({
        secret: await TEST_ARGON.encrypt("secret"),
      }),
    );

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      createTestBrowserSession({ clients: [client.id] }),
    );

    const consentSession = await TEST_CONSENT_SESSION_REPOSITORY.create(
      createTestConsentSession({
        audiences: [configuration.oauth.client_id, client.id],
        clientId: client.id,
        identityId: browserSession.identityId,
        scopes: client.allowed.scopes,
        sessions: [browserSession.id],
      }),
    );

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        clientId: client.id,
        code: {
          codeChallenge,
          codeChallengeMethod,
        },
        identifiers: {
          browserSessionId: browserSession.id,
          consentSessionId: consentSession.id,
          refreshSessionId: null,
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
      .send({
        client_id: client.id,
        client_secret: "secret",
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
      scope: consentSession.scopes,
      token_type: "Bearer",
    });
  });

  test("should resolve for client credentials grant type", async () => {
    const client = await TEST_CLIENT_CACHE.create(
      createTestClient({
        secret: await TEST_ARGON.encrypt("secret"),
      }),
    );

    const response = await request(server.callback())
      .post("/oauth2/token")
      .send({
        client_id: client.id,
        client_secret: "secret",
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
    const client = await TEST_CLIENT_CACHE.create(
      createTestClient({
        secret: await TEST_ARGON.encrypt("secret"),
      }),
    );

    const refreshSession = await TEST_REFRESH_SESSION_REPOSITORY.create(
      createTestRefreshSession({
        clientId: client.id,
        identityId: "d821cde6-250f-4918-ad55-877a7abf0271",
        tokenId: randomUUID(),
      }),
    );

    await TEST_CONSENT_SESSION_REPOSITORY.create(
      createTestConsentSession({
        audiences: [configuration.oauth.client_id, client.id],
        clientId: client.id,
        identityId: "d821cde6-250f-4918-ad55-877a7abf0271",
        scopes: client.allowed.scopes,
        sessions: [refreshSession.id],
      }),
    );

    const refreshToken = getTestRefreshToken({
      id: refreshSession.tokenId,
      audiences: [configuration.oauth.client_id, client.id],
      sessionId: refreshSession.id,
      subject: "d821cde6-250f-4918-ad55-877a7abf0271",
    });

    const response = await request(server.callback())
      .post("/oauth2/token")
      .send({
        client_id: client.id,
        client_secret: "secret",
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
