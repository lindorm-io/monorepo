import MockDate from "mockdate";
import request from "supertest";
import { ClientType } from "../../../common";
import { koa } from "../../../server/koa";
import { randomUUID } from "crypto";
import {
  getTestClient,
  getTestConsentSession,
  getTestBrowserSession,
  getTestLogoutSession,
} from "../../../test/entity";
import {
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_CACHE,
  TEST_CONSENT_SESSION_REPOSITORY,
  TEST_LOGOUT_SESSION_CACHE,
  getAxiosResponse,
  getTestClientCredentials,
  setAxiosResponse,
  setupIntegration,
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

describe("/internal/sessions/logout", () => {
  beforeAll(setupIntegration);

  test("GET /:id", async () => {
    const client = await TEST_CLIENT_CACHE.create(
      getTestClient({
        type: ClientType.CONFIDENTIAL,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [client.id],
      subject: client.id,
    });

    const consentSession = await TEST_CONSENT_SESSION_REPOSITORY.create(
      getTestConsentSession({
        audiences: [client.id],
        clientId: client.id,
        identityId: randomUUID(),
        scopes: ["openid"],
      }),
    );

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      getTestBrowserSession({
        identityId: consentSession.identityId,
      }),
    );

    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(
      getTestLogoutSession({
        clientId: client.id,
        sessionId: browserSession.id,
      }),
    );

    const response = await request(koa.callback())
      .get(`/internal/sessions/logout/${logoutSession.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      client: {
        description: "Client description",
        logo_uri: "https://logo.uri/logo",
        name: "ClientName",
        type: "confidential",
      },
      logout_session: {
        id: logoutSession.id,
        expires_at: "2021-01-02T08:00:00.000Z",
        expires_in: 86400,
        original_uri: "https://localhost/oauth/sessions/logout?query=query",
      },
      logout_status: "pending",
    });
  });

  test("PUT /:id/confirm", async () => {
    const client = await TEST_CLIENT_CACHE.create(
      getTestClient({
        type: ClientType.CONFIDENTIAL,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [client.id],
      subject: client.id,
    });

    const consentSession = await TEST_CONSENT_SESSION_REPOSITORY.create(
      getTestConsentSession({
        audiences: [client.id],
        clientId: client.id,
        identityId: randomUUID(),
        scopes: ["openid"],
      }),
    );

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      getTestBrowserSession({
        clients: [client.id],
        identityId: consentSession.identityId,
      }),
    );

    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(
      getTestLogoutSession({
        clientId: client.id,
        sessionId: browserSession.id,
      }),
    );

    setAxiosResponse(
      "get",
      "axiosClient",
      "https://test.client.lindorm.io/logout/back-channel",
      {},
    );

    const response = await request(koa.callback())
      .put(`/internal/sessions/logout/${logoutSession.id}/confirm`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    const url = new URL(response.body.redirect_to);

    expect(url.origin).toBe("https://oauth.test.api.lindorm.io");
    expect(url.pathname).toBe("/oauth/sessions/logout/verify");
    expect(url.searchParams.get("session_id")).toStrictEqual(logoutSession.id);
    expect(url.searchParams.get("redirect_uri")).toStrictEqual(logoutSession.redirectUri);
  });

  test("PUT /:id/reject", async () => {
    const client = await TEST_CLIENT_CACHE.create(
      getTestClient({
        type: ClientType.CONFIDENTIAL,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [client.id],
      subject: client.id,
    });

    const consentSession = await TEST_CONSENT_SESSION_REPOSITORY.create(
      getTestConsentSession({
        audiences: [client.id],
        clientId: client.id,
        identityId: randomUUID(),
        scopes: ["openid"],
      }),
    );

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      getTestBrowserSession({
        identityId: consentSession.identityId,
      }),
    );

    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(
      getTestLogoutSession({
        clientId: client.id,
        sessionId: browserSession.id,
      }),
    );

    const response = await request(koa.callback())
      .put(`/internal/sessions/logout/${logoutSession.id}/reject`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      redirect_to:
        "https://test.client.lindorm.io/redirect?error=request_rejected&error_description=logout_rejected&state=YuTs0Kaf8UV1I086TptUqz1Yh1PNoJow",
    });
  });
});
