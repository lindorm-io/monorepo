import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { FlowType } from "../../../enum";
import { getTestData } from "../../../fixtures/data";
import { server } from "../../../server/server";
import {
  createTestAccount,
  createTestFlowSession,
  createTestLoginSession,
} from "../../../fixtures/entity";
import {
  TEST_ACCOUNT_REPOSITORY,
  TEST_FLOW_SESSION_CACHE,
  TEST_LOGIN_SESSION_CACHE,
  setupIntegration,
} from "../../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessions/login", () => {
  beforeAll(setupIntegration);

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      access_token: "accessToken",
      expires_in: 100,
      scope: ["scope"],
    });

  nock("https://device.test.lindorm.io")
    .get((uri) => uri.startsWith("/internal/identities/") && uri.endsWith("/device-links"))
    .times(999)
    .reply(200, {
      deviceLinks: ["ef79052f-827d-427d-be47-99d13a06293d"],
    });

  nock("https://oauth.test.lindorm.io")
    .get((uri) => uri.startsWith("/internal/identities/") && uri.endsWith("/sessions"))
    .times(999)
    .reply(200, {
      sessions: [
        { id: "f29ff076-957f-46f3-bb0a-d8323750a8c1", levelOfAssurance: 4 },
        { id: "0e69dd20-fa2c-4348-9ef8-2f1825020192", levelOfAssurance: 3 },
      ],
    });

  nock("https://oauth.test.lindorm.io")
    .put((uri) => uri.startsWith("/internal/sessions/authentication/") && uri.endsWith("/reject"))
    .times(999)
    .reply(200, {
      redirect_to: "https://redirect.uri",
    });

  test("POST /", async () => {
    const account = await TEST_ACCOUNT_REPOSITORY.create(createTestAccount());

    const { pkceChallenge, pkceMethod } = getTestData();

    const response = await request(server.callback())
      .post("/sessions/login")
      .send({
        flow_type: FlowType.DEVICE_CHALLENGE,
        country: "se",
        identity_id: account.id,
        pkce_challenge: pkceChallenge,
        pkce_method: pkceMethod,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      id: expect.any(String),
      flow: {
        id: expect.any(String),
        flow_token: expect.any(String),
        polling_required: true,
      },
    });
  });

  test("GET /", async () => {
    const loginSession = await TEST_LOGIN_SESSION_CACHE.create(
      createTestLoginSession({
        amrValues: [],
        identityId: null,
        levelOfAssurance: 0,
      }),
    );

    const flowSession = await TEST_FLOW_SESSION_CACHE.create(
      createTestFlowSession({
        loginSessionId: loginSession.id,
      }),
    );

    const response = await request(server.callback())
      .get("/sessions/login")
      .set("Cookie", [
        `lindorm_io_authentication_login_session=${loginSession.id}; path=/; domain=https://authentication.test.lindorm.io; samesite=none`,
      ])
      .expect(200);

    expect(response.body).toStrictEqual({
      available_flows: [
        "bank_id_se",
        "device_challenge",
        "email_link",
        "email_otp",
        "password",
        "phone_otp",
        "rdc_qr_code",
        "session_accept_with_code",
        "webauthn",
      ],
      available_oidc: ["apple", "google", "microsoft"],
      current_flow: {
        id: flowSession.id,
        flow_type: "email_otp",
        polling_required: false,
        status: "pending",
      },
      login_hint: ["test@lindorm.io", "+46705498721"],
      prioritized_flow: "bank_id_se",
      remember: true,
      requested_methods: ["email_otp"],
    });
  });

  test("PUT /reject", async () => {
    const loginSession = await TEST_LOGIN_SESSION_CACHE.create(createTestLoginSession());

    const response = await request(server.callback())
      .put("/sessions/login/reject")
      .set("Cookie", [
        `lindorm_io_authentication_login_session=${loginSession.id}; path=/; domain=https://authentication.test.lindorm.io; samesite=none`,
      ])
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://redirect.uri");

    expect(response.headers["set-cookie"]).toEqual([
      "lindorm_io_authentication_login_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly",
    ]);
  });
});
