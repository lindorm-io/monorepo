import { OpenIdGrantType } from "@lindorm-io/common-types";
import { baseHash } from "@lindorm-io/core";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { ClientSessionType } from "../../enum";
import { getTestData, TEST_GET_USERINFO_RESPONSE } from "../../fixtures/data";
import {
  createTestAuthorizationCode,
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
  createTestRefreshToken,
  createTestTenant,
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
  TEST_TENANT_REPOSITORY,
} from "../../fixtures/integration";
import { configuration } from "../../server/configuration";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/token", () => {
  beforeAll(setupIntegration);

  nock("https://authentication.test.lindorm.io")
    .get("/admin/grant-types/authentication-token")
    .query(true)
    .times(1)
    .reply(200, {
      identityId: randomUUID(),
      latestAuthentication: new Date().toISOString(),
      levelOfAssurance: 2,
      methods: ["email"],
      nonce: randomString(16),
    });

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

  test("should resolve for authentication token grant type", async () => {
    const tenant = await TEST_TENANT_REPOSITORY.create(createTestTenant());
    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        secret: await TEST_ARGON.encrypt("secret"),
        tenantId: tenant.id,
      }),
    );

    const response = await request(server.callback())
      .post("/oauth2/token")
      .set("Authorization", `Basic ${baseHash(`${client.id}:secret`)}`)
      .send({
        grant_type: OpenIdGrantType.AUTHENTICATION_TOKEN,
        authentication_token: "authentication_token",
        scope: client.allowed.scopes.join(" "),
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      access_token: expect.any(String),
      expires_in: 99,
      id_token: expect.any(String),
      refresh_token: expect.any(String),
      scope:
        "address email offline_access openid phone profile accessibility national_identity_number public social_security_number username",
      token_type: "Bearer",
    });
  });

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
        AuthorizationSessionId: authorizationSession.id,
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
        grant_type: OpenIdGrantType.AUTHORIZATION_CODE,
        redirect_uri: authorizationSession.redirectUri,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      access_token: expect.any(String),
      expires_in: 99,
      id_token: expect.any(String),
      refresh_token: expect.any(String),
      scope:
        "address email offline_access openid phone profile accessibility national_identity_number public social_security_number username",
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
        grant_type: OpenIdGrantType.CLIENT_CREDENTIALS,
        scope: client.allowed.scopes.join(" "),
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      access_token: expect.any(String),
      expires_in: 60,
      scope:
        "address email offline_access openid phone profile accessibility national_identity_number public social_security_number username",
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
        grant_type: OpenIdGrantType.REFRESH_TOKEN,
        refresh_token: refreshToken.signature,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      access_token: expect.any(String),
      expires_in: 99,
      id_token: expect.any(String),
      refresh_token: expect.any(String),
      scope:
        "address email offline_access openid phone profile accessibility national_identity_number public social_security_number username",
      token_type: "Bearer",
    });
  });
});
