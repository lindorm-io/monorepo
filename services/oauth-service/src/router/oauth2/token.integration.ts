import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { GrantType } from "../../common";
import { TEST_GET_USERINFO_RESPONSE, getTestData } from "../../test/data";
import { server } from "../../server/server";
import { randomUUID } from "crypto";
import {
  getTestAuthorizationSession,
  getTestClient,
  getTestConsentSession,
  getTestBrowserSession,
  getTestRefreshSession,
} from "../../test/entity";
import {
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_CLIENT_CACHE,
  TEST_CONSENT_SESSION_REPOSITORY,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_ARGON,
  TEST_REFRESH_SESSION_REPOSITORY,
  getTestRefreshToken,
  setupIntegration,
} from "../../test/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("/oauth2/token", () => {
  beforeAll(setupIntegration);

  nock("https://identity.test.lindorm.io")
    .get("/internal/userinfo/d821cde6-250f-4918-ad55-877a7abf0271")
    .query(true)
    .times(999)
    .reply(200, TEST_GET_USERINFO_RESPONSE);

  test("POST / - AUTHORIZATION_CODE", async () => {
    const { code, codeChallenge, codeChallengeMethod, codeVerifier, nonce, state } = getTestData();

    const client = await TEST_CLIENT_CACHE.create(
      getTestClient({
        secret: await TEST_ARGON.encrypt("secret"),
      }),
    );

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      getTestBrowserSession({
        identityId: "d821cde6-250f-4918-ad55-877a7abf0271",
      }),
    );

    const consentSession = await TEST_CONSENT_SESSION_REPOSITORY.create(
      getTestConsentSession({
        audiences: [client.id],
        clientId: client.id,
        identityId: "d821cde6-250f-4918-ad55-877a7abf0271",
        scopes: client.allowed.scopes,
        sessions: [browserSession.id],
      }),
    );

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      getTestAuthorizationSession({
        audiences: [client.id],
        clientId: client.id,
        code,
        codeChallenge,
        codeChallengeMethod,
        browserSessionId: browserSession.id,
        consentSessionId: consentSession.id,
        identityId: "d821cde6-250f-4918-ad55-877a7abf0271",
        levelOfAssurance: browserSession.levelOfAssurance,
        nonce,
        scopes: consentSession.scopes,
        state,
      }),
    );

    const response = await request(server.callback())
      .post("/oauth2/token")
      .send({
        client_id: client.id,
        client_secret: "secret",
        code,
        code_verifier: codeVerifier,
        grant_type: GrantType.AUTHORIZATION_CODE,
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

  test("POST / - CLIENT_CREDENTIALS", async () => {
    const client = await TEST_CLIENT_CACHE.create(
      getTestClient({
        secret: await TEST_ARGON.encrypt("secret"),
      }),
    );

    const response = await request(server.callback())
      .post("/oauth2/token")
      .send({
        client_id: client.id,
        client_secret: "secret",
        grant_type: GrantType.CLIENT_CREDENTIALS,
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

  test("POST / - REFRESH_TOKEN", async () => {
    const client = await TEST_CLIENT_CACHE.create(
      getTestClient({
        secret: await TEST_ARGON.encrypt("secret"),
      }),
    );

    const refreshSession = await TEST_REFRESH_SESSION_REPOSITORY.create(
      getTestRefreshSession({
        clientId: client.id,
        identityId: "d821cde6-250f-4918-ad55-877a7abf0271",
        tokenId: randomUUID(),
      }),
    );

    await TEST_CONSENT_SESSION_REPOSITORY.create(
      getTestConsentSession({
        audiences: [client.id],
        clientId: client.id,
        identityId: "d821cde6-250f-4918-ad55-877a7abf0271",
        scopes: client.allowed.scopes,
        sessions: [refreshSession.id],
      }),
    );

    const refreshToken = getTestRefreshToken({
      id: refreshSession.tokenId,
      audiences: [client.id],
      sessionId: refreshSession.id,
      subject: "d821cde6-250f-4918-ad55-877a7abf0271",
    });

    const response = await request(server.callback())
      .post("/oauth2/token")
      .send({
        client_id: client.id,
        client_secret: "secret",
        grant_type: GrantType.REFRESH_TOKEN,
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
