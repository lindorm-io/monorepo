import {
  OpenIdClientType,
  OpenIdDisplayMode,
  Scope,
  SessionStatus,
} from "@lindorm-io/common-enums";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { mockFetchOauthAuthorizationSession } from "../../fixtures/axios";
import { setupIntegration } from "../../fixtures/integration";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/consent", () => {
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
    .post((uri) => uri.startsWith("/admin/sessions/consent/") && uri.endsWith("/confirm"))
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

  test("should redirect to front end", async () => {
    nock("https://oauth.test.lindorm.io")
      .get("/admin/sessions/authorization/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8")
      .reply(200, mockFetchOauthAuthorizationSession());

    const response = await request(server.callback())
      .get("/oauth2/consent")
      .query({
        session: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8",
        display: OpenIdDisplayMode.PAGE,
        locales: "sv-SE en-GB",
      })
      .expect(302);

    const location = new URL(response.headers.location);

    expect(location.origin).toBe("https://frontend.url");
    expect(location.pathname).toBe("/api/consent");
    expect(location.searchParams.get("session")).toBe("28c0d2ce-a3b4-45d8-9845-89d60fe8fed8");
  });

  test("should redirect to verify endpoint on unexpected status", async () => {
    nock("https://oauth.test.lindorm.io")
      .get("/admin/sessions/authorization/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8")
      .reply(
        200,
        mockFetchOauthAuthorizationSession({
          consent: {
            isRequired: false,
            status: SessionStatus.CONFIRMED,

            audiences: [randomUUID()],
            optionalScopes: [
              Scope.ACCESSIBILITY,
              Scope.NATIONAL_IDENTITY_NUMBER,
              Scope.PUBLIC,
              Scope.SOCIAL_SECURITY_NUMBER,
              Scope.USERNAME,
            ],
            requiredScopes: [
              Scope.ADDRESS,
              Scope.EMAIL,
              Scope.OFFLINE_ACCESS,
              Scope.OPENID,
              Scope.PHONE,
              Scope.PROFILE,
            ],
            scopeDescriptions: [],
          },
        }),
      );

    const response = await request(server.callback())
      .get("/oauth2/consent")
      .query({
        session: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8",
        display: OpenIdDisplayMode.PAGE,
        locales: "sv-SE en-GB",
      })
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://oauth-redirect-verify.url");

    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  test("should confirm confidential clients and redirect", async () => {
    nock("https://oauth.test.lindorm.io")
      .get("/admin/sessions/authorization/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8")
      .reply(
        200,
        mockFetchOauthAuthorizationSession({
          consent: {
            isRequired: false,
            status: SessionStatus.PENDING,

            audiences: [randomUUID()],
            optionalScopes: [
              Scope.ACCESSIBILITY,
              Scope.NATIONAL_IDENTITY_NUMBER,
              Scope.PUBLIC,
              Scope.SOCIAL_SECURITY_NUMBER,
              Scope.USERNAME,
            ],
            requiredScopes: [
              Scope.ADDRESS,
              Scope.EMAIL,
              Scope.OFFLINE_ACCESS,
              Scope.OPENID,
              Scope.PHONE,
              Scope.PROFILE,
            ],
            scopeDescriptions: [],
          },

          client: {
            id: randomUUID(),
            logoUri: "https://test.client.com/logo.png",
            name: "Test Client",
            singleSignOn: true,
            type: OpenIdClientType.CONFIDENTIAL,
          },
        }),
      );

    const response = await request(server.callback())
      .get("/oauth2/consent")
      .query({
        session: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8",
        display: OpenIdDisplayMode.PAGE,
        locales: "sv-SE en-GB",
      })
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://oauth-redirect-confirm.url");
  });
});
