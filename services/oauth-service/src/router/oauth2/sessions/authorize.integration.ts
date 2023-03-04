import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { TEST_GET_USERINFO_RESPONSE } from "../../../fixtures/data";
import { configuration } from "../../../server/configuration";
import { createURL } from "@lindorm-io/url";
import { server } from "../../../server/server";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
} from "../../../fixtures/entity";
import {
  setupIntegration,
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_REPOSITORY,
  TEST_CLIENT_SESSION_REPOSITORY,
} from "../../../fixtures/integration";
import {
  AuthenticationMethod,
  OpenIdResponseMode,
  OpenIdScope,
  SessionStatus,
} from "@lindorm-io/common-types";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/sessions/authorize", () => {
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

  test("should resolve redirect with query", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        audiences: [configuration.oauth.client_id, client.id],
        browserSessionId: browserSession.id,
        clientId: client.id,
        identityId: browserSession.identityId,
        latestAuthentication: new Date(),
        levelOfAssurance: 3,
        scopes: [
          OpenIdScope.OPENID,
          OpenIdScope.OFFLINE_ACCESS,
          OpenIdScope.EMAIL,
          OpenIdScope.PHONE,
        ],
      }),
    );

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        clientId: client.id,
        clientSessionId: clientSession.id,
        browserSessionId: browserSession.id,
        confirmedConsent: {
          audiences: [client.id],
          scopes: [OpenIdScope.OPENID, OpenIdScope.OFFLINE_ACCESS, OpenIdScope.EMAIL],
        },
        confirmedLogin: {
          identityId: clientSession.identityId,
          latestAuthentication: new Date(),
          levelOfAssurance: 3,
          metadata: {},
          methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
          remember: true,
          sso: true,
        },
        responseMode: OpenIdResponseMode.QUERY,
        status: {
          login: SessionStatus.CONFIRMED,
          consent: SessionStatus.CONFIRMED,
          selectAccount: SessionStatus.SKIP,
        },
      }),
    );

    const url = createURL("/oauth2/sessions/authorize/verify", {
      host: "https://test.test",
      query: {
        session: authorizationSession.id,
        redirectUri: authorizationSession.redirectUri,
      },
    }).toString();

    const response = await request(server.callback())
      .get(url.replace("https://test.test", ""))
      .set("Cookie", [
        `lindorm_io_oauth_authorization_session=${authorizationSession.id}; path=/; httponly`,
        `lindorm_io_oauth_browser_sessions=["${browserSession.id}"]; path=/; httponly`,
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
        expect.stringContaining(
          "lindorm_io_oauth_authorization_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly",
        ),
        expect.stringContaining(
          `lindorm_io_oauth_browser_sessions=["${browserSession.id}"]; path=/; expires=Mon, 01 Jan 2120 08:00:00 GMT; httponly`,
        ),
      ]),
    );
  });

  test("should resolve redirect with form post", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        audiences: [configuration.oauth.client_id, client.id],
        browserSessionId: browserSession.id,
        clientId: client.id,
        identityId: browserSession.identityId,
        latestAuthentication: new Date(),
        levelOfAssurance: 3,
        scopes: [
          OpenIdScope.OPENID,
          OpenIdScope.OFFLINE_ACCESS,
          OpenIdScope.EMAIL,
          OpenIdScope.PHONE,
        ],
      }),
    );

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        clientId: client.id,
        browserSessionId: browserSession.id,
        clientSessionId: clientSession.id,
        confirmedConsent: {
          audiences: [client.id],
          scopes: [OpenIdScope.OPENID, OpenIdScope.OFFLINE_ACCESS, OpenIdScope.EMAIL],
        },
        confirmedLogin: {
          identityId: clientSession.identityId,
          latestAuthentication: new Date(),
          levelOfAssurance: 3,
          metadata: {},
          methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
          remember: true,
          sso: true,
        },
        responseMode: OpenIdResponseMode.FORM_POST,
        status: {
          login: SessionStatus.CONFIRMED,
          consent: SessionStatus.CONFIRMED,
          selectAccount: SessionStatus.SKIP,
        },
      }),
    );

    const url = createURL("/oauth2/sessions/authorize/verify", {
      host: "https://test.test",
      query: {
        session: authorizationSession.id,
        redirectUri: authorizationSession.redirectUri,
      },
    }).toString();

    const response = await request(server.callback())
      .get(url.replace("https://test.test", ""))
      .set("Cookie", [
        `lindorm_io_oauth_authorization_session=${authorizationSession.id}; path=/;`,
        `lindorm_io_oauth_browser_sessions=["${browserSession.id}"]; path=/; httponly`,
      ])
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
        expect.stringContaining(
          "lindorm_io_oauth_authorization_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly",
        ),
        expect.stringContaining(
          `lindorm_io_oauth_browser_sessions=["${browserSession.id}"]; path=/; expires=Mon, 01 Jan 2120 08:00:00 GMT; httponly`,
        ),
      ]),
    );
  });
});
