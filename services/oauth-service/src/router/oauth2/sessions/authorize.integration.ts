import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { TEST_GET_USERINFO_RESPONSE } from "../../../fixtures/data";
import { createTestAuthorizationSession, createTestClient } from "../../../fixtures/entity";
import { createURL } from "@lindorm-io/url";
import { server } from "../../../server/server";
import {
  setupIntegration,
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_CLIENT_CACHE,
} from "../../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/sessions/verify", () => {
  beforeAll(setupIntegration);

  nock("https://identity.test.lindorm.io")
    .get("/userinfo")
    .times(999)
    .reply(200, TEST_GET_USERINFO_RESPONSE);

  test("should resolve redirect with query", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        clientId: client.id,
        confirmedConsent: {
          audiences: [client.id],
          scopes: ["openid", "offline_access", "email"],
        },
        confirmedLogin: {
          acrValues: ["loa_3"],
          amrValues: ["email", "phone"],
          identityId: "d821cde6-250f-4918-ad55-877a7abf0271",
          latestAuthentication: new Date(),
          levelOfAssurance: 3,
          remember: true,
        },
        responseMode: "query",
        status: {
          login: "confirmed",
          consent: "confirmed",
        },
      }),
    );

    const url = createURL("/oauth2/sessions/authorize/verify", {
      host: "https://test.test",
      query: {
        sessionId: authorizationSession.id,
        redirectUri: authorizationSession.redirectUri,
      },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .set("Cookie", [
        `lindorm_io_oauth_authorization_session=${authorizationSession.id}; path=/; httponly`,
      ])
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://test.client.lindorm.io");
    expect(location.pathname).toBe("/redirect");
    expect(location.searchParams.get("access_token")).toStrictEqual(expect.any(String));
    expect(location.searchParams.get("code")).toStrictEqual(expect.any(String));
    expect(location.searchParams.get("expires_in")).toBe("99");
    expect(location.searchParams.get("id_token")).toStrictEqual(expect.any(String));
    expect(location.searchParams.get("state")).toBe(authorizationSession.state);
    expect(location.searchParams.get("token_type")).toBe("Bearer");

    expect(response.headers["set-cookie"]).toStrictEqual(
      expect.arrayContaining([
        expect.stringContaining("lindorm_io_oauth_browser_session="),
        expect.stringContaining("lindorm_io_oauth_authorization_session=;"),
      ]),
    );
  });

  test("should resolve redirect with form post", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        clientId: client.id,
        confirmedConsent: {
          audiences: [client.id],
          scopes: ["openid", "offline_access", "email"],
        },
        confirmedLogin: {
          acrValues: ["loa_3"],
          amrValues: ["email", "phone"],
          identityId: "d821cde6-250f-4918-ad55-877a7abf0271",
          latestAuthentication: new Date(),
          levelOfAssurance: 3,
          remember: true,
        },
        responseMode: "form_post",
        status: {
          login: "confirmed",
          consent: "confirmed",
        },
      }),
    );

    const url = createURL("/oauth2/sessions/authorize/verify", {
      host: "https://test.test",
      query: {
        sessionId: authorizationSession.id,
        redirectUri: authorizationSession.redirectUri,
      },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .set("Cookie", [`lindorm_io_oauth_authorization_session=${authorizationSession.id}; path=/;`])
      .expect(308);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://test.client.lindorm.io");
    expect(location.pathname).toBe("/redirect");
    expect(response.body).toStrictEqual({
      access_token: expect.any(String),
      code: expect.any(String),
      expires_in: 99,
      id_token: expect.any(String),
      redirect_data:
        "ZXlKemRISnBibWNpT2lKemRISnBibWNpTENKdWRXMWlaWElpT2pFeU15d2lZbTl2YkdWaGJpSTZkSEoxWlgwPQ==",
      state: authorizationSession.state,
      token_type: "Bearer",
    });

    expect(response.headers["set-cookie"]).toStrictEqual(
      expect.arrayContaining([
        expect.stringContaining("lindorm_io_oauth_browser_session="),
        expect.stringContaining("lindorm_io_oauth_authorization_session=;"),
      ]),
    );
  });
});
