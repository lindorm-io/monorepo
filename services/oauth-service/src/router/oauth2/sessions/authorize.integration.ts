import { TransformMode } from "@lindorm-io/case";
import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  OpenIdResponseMode,
  Scope,
  SessionStatus,
} from "@lindorm-io/common-enums";
import { createURL } from "@lindorm-io/url";
import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { TEST_GET_USERINFO_RESPONSE } from "../../../fixtures/data";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
} from "../../../fixtures/entity";
import {
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_REPOSITORY,
  TEST_CLIENT_SESSION_REPOSITORY,
  setupIntegration,
} from "../../../fixtures/integration";
import { configuration } from "../../../server/configuration";
import { server } from "../../../server/server";

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

  nock("https://test.client.lindorm.io")
    .get("/.well-known/jwks.json")
    .query(true)
    .times(999)
    .reply(200, {
      keys: [
        {
          alg: "RS512",
          e: "AQAB",
          key_ops: ["decrypt", "encrypt", "verify"],
          kid: "2d60172d-ac8a-4eaf-8ccd-873fc22dcb28",
          kty: "RSA",
          n: "yjql5hIlllH81iamrW5BtOjIc9TKD0+dMazmKhKq/waqKcYtgI06p4YmF940f3OW8dKKXRLBbvu++VBN6/RMP9JFpYg1r4U1UbqwDMFeRRFiMZgH86FW6KhhyECxkWm6/5NRdu7cEw5mNVi08i0MsxuvFWEvSTArBLP5Ctw9m3KNza/HRlO4oVPaiwtxadTlqyYsFr2cEwjZvAadrrj1tLiasCX/UcmBE5Csoo8hayUXdM9hofg2QBXYGKiRTCr5WnxIKfagmzhGdClmZw6C+/8QWogm3tREq52IX5DPwEjUJ0Lq2AZ2O7HMpMx0NwkwrDSysT6K+klphyrpe1WG0RvEzeSQ7jfRf5Xe997LPv5LB6nFz4HtOaVcM2sEGHqS9iPWByAX4Y+2zvQvbDQPAcpEVojPRWJeZLEYJUvIhEeZ5Q9pOobF0qKH3dxxZNSDCXkVSrne6au7sfSR7toqqnBSOTpWCluzw1SjYBKd6cP0tNgkjUEvJFb1QsAV3GNbppFch4LCc5/MSX07l1MdlZ44H8TYAA20VWmsYBW00EFRITe0bNIAxl5wos3NLduozOMZwWRXawDWUQqejeJjggM2QtO0yuRuvVFlhQqs5sHz8fsux7RIkE/gVDy51ai+hUQ4GL3o0ELSsLzfTzUhRvUqSW8/kAf5GZnygQgGrMs=",
          use: "enc",
        },
      ],
    });

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
        scopes: [Scope.OPENID, Scope.OFFLINE_ACCESS, Scope.EMAIL, Scope.PHONE],
      }),
    );

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        clientId: client.id,
        clientSessionId: clientSession.id,
        browserSessionId: browserSession.id,
        confirmedConsent: {
          audiences: [client.id],
          scopes: [Scope.OPENID, Scope.OFFLINE_ACCESS, Scope.EMAIL],
        },
        confirmedLogin: {
          factors: [AuthenticationFactor.TWO_FACTOR],
          identityId: clientSession.identityId,
          latestAuthentication: new Date(),
          levelOfAssurance: 3,
          metadata: {},
          methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
          remember: true,
          singleSignOn: true,
          strategies: [AuthenticationStrategy.EMAIL_OTP, AuthenticationStrategy.PHONE_OTP],
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
      queryCaseTransform: TransformMode.SNAKE,
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
        scopes: [Scope.OPENID, Scope.OFFLINE_ACCESS, Scope.EMAIL, Scope.PHONE],
      }),
    );

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        clientId: client.id,
        browserSessionId: browserSession.id,
        clientSessionId: clientSession.id,
        confirmedConsent: {
          audiences: [client.id],
          scopes: [Scope.OPENID, Scope.OFFLINE_ACCESS, Scope.EMAIL],
        },
        confirmedLogin: {
          factors: [AuthenticationFactor.TWO_FACTOR],
          identityId: clientSession.identityId,
          latestAuthentication: new Date(),
          levelOfAssurance: 3,
          metadata: {},
          methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
          remember: true,
          singleSignOn: true,
          strategies: [AuthenticationStrategy.EMAIL_OTP, AuthenticationStrategy.PHONE_OTP],
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
      queryCaseTransform: TransformMode.SNAKE,
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
