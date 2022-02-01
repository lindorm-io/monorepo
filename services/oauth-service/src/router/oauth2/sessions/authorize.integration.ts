import MockDate from "mockdate";
import request from "supertest";
import { IdentityPermission, ResponseMode, Scope, SessionStatus } from "../../../common";
import { TEST_GET_USERINFO_RESPONSE } from "../../../test/data";
import { createURL } from "@lindorm-io/core";
import { koa } from "../../../server/koa";
import { randomUUID } from "crypto";
import {
  getTestAuthorizationSession,
  getTestBrowserSession,
  getTestClient,
  getTestConsentSession,
} from "../../../test/entity";
import {
  getAxiosResponse,
  setAxiosResponse,
  setupIntegration,
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_CACHE,
  TEST_CONSENT_SESSION_REPOSITORY,
} from "../../../test/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("@lindorm-io/axios", () => ({
  ...(jest.requireActual("@lindorm-io/axios") as Record<string, any>),
  Axios: class Axios {
    private readonly name: string;
    public constructor(opts: any) {
      this.name = opts.name;
    }
    public async get(path: string, args: any): Promise<any> {
      return getAxiosResponse("GET", this.name, path, args);
    }
    public async post(path: string, args: any): Promise<any> {
      return getAxiosResponse("POST", this.name, path, args);
    }
  },
}));

describe("/oauth2/sessions/verify", () => {
  beforeAll(setupIntegration);

  test("GET /verify - QUERY", async () => {
    const identityId = randomUUID();

    const client = await TEST_CLIENT_CACHE.create(getTestClient());

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      getTestBrowserSession({
        acrValues: ["loa_3"],
        amrValues: ["email_otp", "phone_otp"],
        clients: [],
        identityId,
        levelOfAssurance: 3,
      }),
    );

    const consentSession = await TEST_CONSENT_SESSION_REPOSITORY.create(
      getTestConsentSession({
        audiences: [client.id],
        clientId: client.id,
        identityId,
        scopes: [Scope.OPENID, Scope.OFFLINE_ACCESS, Scope.EMAIL],
        sessions: [browserSession.id],
      }),
    );

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      getTestAuthorizationSession({
        browserSessionId: browserSession.id,
        clientId: client.id,
        authenticationStatus: SessionStatus.CONFIRMED,
        consentStatus: SessionStatus.CONFIRMED,
        consentSessionId: consentSession.id,
        identityId,
        promptModes: [],
        scopes: [Scope.OPENID, Scope.OFFLINE_ACCESS, Scope.EMAIL],
      }),
    );

    setAxiosResponse("get", "identityClient", "/internal/userinfo/:id", TEST_GET_USERINFO_RESPONSE);

    const url = createURL("/oauth2/sessions/authorize/verify", {
      baseUrl: "https://test.test",
      query: {
        sessionId: authorizationSession.id,
        redirectUri: authorizationSession.redirectUri,
      },
    });

    const response = await request(koa.callback())
      .get(url.toString().replace("https://test.test", ""))
      .set("Cookie", [
        `lindorm_io_oauth_authorization_session=${authorizationSession.id}; path=/; domain=https://oauth.test.api.lindorm.io; samesite=none`,
        `lindorm_io_oauth_browser_session=${browserSession.id}; path=/; domain=https://oauth.test.api.lindorm.io; samesite=none`,
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
  });

  test("GET /verify - FORM_POST", async () => {
    const identityId = randomUUID();

    const client = await TEST_CLIENT_CACHE.create(getTestClient());

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      getTestBrowserSession({
        acrValues: ["loa_3"],
        amrValues: ["email_otp", "phone_otp"],
        clients: [],
        identityId,
        levelOfAssurance: 3,
      }),
    );

    const consentSession = await TEST_CONSENT_SESSION_REPOSITORY.create(
      getTestConsentSession({
        audiences: [client.id],
        clientId: client.id,
        identityId,
        scopes: [Scope.OPENID, Scope.OFFLINE_ACCESS, Scope.EMAIL],
        sessions: [browserSession.id],
      }),
    );

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      getTestAuthorizationSession({
        browserSessionId: browserSession.id,
        clientId: client.id,
        authenticationStatus: SessionStatus.CONFIRMED,
        consentStatus: SessionStatus.CONFIRMED,
        consentSessionId: consentSession.id,
        identityId,
        promptModes: [],
        responseMode: ResponseMode.FORM_POST,
        scopes: [Scope.OPENID, Scope.OFFLINE_ACCESS, Scope.EMAIL],
      }),
    );

    setAxiosResponse("get", "identityClient", "/internal/identities/:id/permissions", {
      active: true,
      permissions: [IdentityPermission.USER],
    });

    setAxiosResponse("get", "identityClient", "/internal/identities/:id/userinfo", {
      sub: identityId,
      ...TEST_GET_USERINFO_RESPONSE,
    });

    const url = createURL("/oauth2/sessions/authorize/verify", {
      baseUrl: "https://test.test",
      query: {
        sessionId: authorizationSession.id,
        redirectUri: authorizationSession.redirectUri,
      },
    });

    const response = await request(koa.callback())
      .get(url.toString().replace("https://test.test", ""))
      .set("Cookie", [
        `lindorm_io_oauth_authorization_session=${authorizationSession.id}; path=/; domain=https://oauth.test.api.lindorm.io; samesite=none`,
        `lindorm_io_oauth_browser_session=${browserSession.id}; path=/; domain=https://oauth.test.api.lindorm.io; samesite=none`,
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
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
      token_type: "Bearer",
    });
  });
});
