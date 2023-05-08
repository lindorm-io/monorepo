import {
  AuthenticationMethod,
  OpenIdDisplayMode,
  OpenIdPromptMode,
  SessionStatus,
} from "@lindorm-io/common-types";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { mockFetchOauthAuthorizationSession } from "../../fixtures/axios";
import { createTestAuthenticationConfirmationToken } from "../../fixtures/entity";
import {
  TEST_AUTHENTICATION_CONFIRMATION_TOKEN_CACHE,
  setupIntegration,
} from "../../fixtures/integration";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth/login", () => {
  beforeAll(setupIntegration);

  nock("https://oauth.test.lindorm.io")
    .get("/.well-known/openid-configuration")
    .times(999)
    .reply(200, {
      token_endpoint: "https://oauth.test.lindorm.io/oauth2/token",
    });

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      access_token: "accessToken",
      expires_in: 100,
      scope: ["scope"],
    });

  nock("https://oauth.test.lindorm.io")
    .get((uri) => uri.startsWith("/admin/sessions/authorization/") && uri.endsWith("/redirect"))
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-verify.url/",
    });

  nock("https://oauth.test.lindorm.io")
    .post((uri) => uri.startsWith("/admin/sessions/login/") && uri.endsWith("/confirm"))
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

  test("should redirect to front end", async () => {
    nock("https://oauth.test.lindorm.io")
      .get("/admin/sessions/authorization/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8")
      .reply(200, mockFetchOauthAuthorizationSession());

    const response = await request(server.callback())
      .get("/oauth/login")
      .query({ session: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" })
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://frontend.url");
    expect(location.pathname).toBe("/api/login");
    expect(location.searchParams.get("session")).toBe("28c0d2ce-a3b4-45d8-9845-89d60fe8fed8");
  });

  test("should redirect to verify endpoint on unexpected status", async () => {
    nock("https://oauth.test.lindorm.io")
      .get(`/admin/sessions/authorization/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8`)
      .reply(
        200,
        mockFetchOauthAuthorizationSession({
          login: {
            isRequired: false,
            status: SessionStatus.CONFIRMED,

            identityId: randomUUID(),
            minimumLevel: 2,
            recommendedLevel: 2,
            recommendedMethods: [AuthenticationMethod.EMAIL],
            requiredLevel: 2,
            requiredMethods: [AuthenticationMethod.EMAIL],
          },
        }),
      );

    const response = await request(server.callback())
      .get("/oauth/login")
      .query({ session: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" })
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://oauth-redirect-verify.url");
  });

  test("should confirm on valid authentication confirmation token", async () => {
    const authenticationConfirmationToken =
      await TEST_AUTHENTICATION_CONFIRMATION_TOKEN_CACHE.create(
        createTestAuthenticationConfirmationToken({
          sessionId: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8",
        }),
      );

    nock("https://oauth.test.lindorm.io")
      .get(`/admin/sessions/authorization/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8`)
      .reply(
        200,
        mockFetchOauthAuthorizationSession({
          authorizationSession: {
            id: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8",
            authToken: authenticationConfirmationToken.token,
            country: "se",
            displayMode: OpenIdDisplayMode.PAGE,
            expires: "2022-01-01T04:00:00.000Z",
            idTokenHint: "id.jwt.jwt",
            loginHint: ["test@lindorm.io"],
            maxAge: 500,
            nonce: randomString(16),
            originalUri: "https://oauth.lindorm.io/oauth2/authorize?query=query",
            promptModes: [
              OpenIdPromptMode.CONSENT,
              OpenIdPromptMode.LOGIN,
              OpenIdPromptMode.SELECT_ACCOUNT,
            ],
            redirectUri: "https://test.client.com/redirect",
            uiLocales: ["en-GB", "sv-SE"],
          },
        }),
      );

    const response = await request(server.callback())
      .get("/oauth/login")
      .query({ session: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" })
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://oauth-redirect-confirm.url");
  });
});
