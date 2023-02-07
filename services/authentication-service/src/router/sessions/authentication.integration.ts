import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { argon } from "../../instance";
import { createTestAuthenticationSession } from "../../fixtures/entity";
import { getTestData } from "../../fixtures/data";
import { randomString } from "@lindorm-io/random";
import { server } from "../../server/server";
import { createURL } from "@lindorm-io/url";
import {
  AuthenticationMethods,
  AuthenticationStrategies,
  SessionStatuses,
} from "@lindorm-io/common-types";
import {
  setupIntegration,
  TEST_AUTHENTICATION_SESSION_CACHE,
  TEST_STRATEGY_SESSION_CACHE,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessions/authentication", () => {
  beforeAll(setupIntegration);

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      access_token: "accessToken",
      expires_in: 100,
      scope: ["scope"],
    });

  nock("https://communication.test.lindorm.io")
    .post("/internal/send/otp")
    .times(999)
    .reply(200, {});

  nock("https://oauth.test.lindorm.io")
    .get((uri) => uri.startsWith("/internal/sessions/login/"))
    .reply(200, {
      authorizationSession: {
        country: "se",
        expires_at: "2021-01-01T08:30:00.000Z",
        login_hint: ["test@email.com", "+46701234567"],
        nonce: "IpoPcFc9nWdB4hfZ",
      },
      requested: {
        identity_id: null,
        minimum_level: 1,
        recommended_level: 2,
        recommended_methods: [AuthenticationMethods.EMAIL],
        required_level: 3,
        required_methods: [AuthenticationMethods.PASSWORD],
      },
    });

  nock("https://oidc.test.lindorm.io").post("/internal/sessions").times(999).reply(200, {
    redirect_to: "https://oidc-redirect.url",
  });

  nock("https://oidc.test.lindorm.io")
    .get((uri) => uri.startsWith("/internal/sessions"))
    .times(999)
    .reply(200, {
      identity_id: null,
      level_of_assurance: 3,
      provider: "apple",
    });

  nock("https://oidc.test.lindorm.io")
    .get("/providers")
    .times(999)
    .reply(200, {
      providers: ["apple", "google", "microsoft"],
    });

  test("should create a new authentication session", async () => {
    const { codeChallenge, codeChallengeMethod, nonce } = getTestData();

    const response = await request(server.callback())
      .post("/sessions/authentication")
      .send({
        client_id: "64d26e49-c9b2-42a7-86c3-1c0fb045e658",
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        country: "en",
        identity_id: "4c875493-575a-4660-94d6-432787597ea2",
        level_of_assurance: 3,
        login_hint: ["test@lindorm.io", "+46701234567"],
        methods: ["email", "phone", "device_link"],
        nonce: nonce,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      id: expect.any(String),
    });
  });

  test("should create a new authentication session linked to oauth session", async () => {
    const { codeChallenge, codeChallengeMethod } = getTestData();

    const response = await request(server.callback())
      .post("/sessions/authentication")
      .send({
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        oauth_session_id: "13ceef97-6824-4468-84bf-07e8a6101ad4",
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      id: expect.any(String),
    });
  });

  test("should return authentication session data", async () => {
    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession(),
    );

    const response = await request(server.callback())
      .get(`/sessions/authentication/${authenticationSession.id}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      config: [
        {
          hint: "none",
          initialise_key: "none",
          method: "bank_id_se",
          rank: 1,
          recommended: false,
          requested: true,
          strategies: ["bank_id_se"],
        },
        {
          hint: "email",
          initialise_key: "email",
          method: "email",
          rank: 2,
          recommended: true,
          requested: false,
          strategies: ["email_otp", "email_link"],
        },
        {
          hint: "phone",
          initialise_key: "phone_number",
          method: "phone",
          rank: 3,
          recommended: true,
          requested: false,
          strategies: ["phone_otp"],
        },
        {
          hint: "none",
          initialise_key: "none",
          method: "device_link",
          rank: 4,
          recommended: false,
          requested: false,
          strategies: ["device_challenge"],
        },
      ],

      email_hint: "test@lindorm.io",
      expires: "2022-01-01T08:00:00.000Z",
      mode: "oauth",
      oidc_providers: ["apple", "google", "microsoft"],
      phone_hint: "0701234567",
      status: "pending",
    });
  });

  test("should return authentication code", async () => {
    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession({
        confirmedStrategies: [AuthenticationStrategies.DEVICE_CHALLENGE],
        status: SessionStatuses.CONFIRMED,
      }),
    );

    const response = await request(server.callback())
      .get(`/sessions/authentication/${authenticationSession.id}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      code: expect.any(String),
      mode: "oauth",
    });

    const found = await TEST_AUTHENTICATION_SESSION_CACHE.find({ id: authenticationSession.id });

    await expect(argon.assert(response.body.code, found.code)).resolves.not.toThrow();
  });

  test("should resolve redirect to oidc", async () => {
    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession(),
    );

    const url = createURL("/sessions/authentication/:id/oidc", {
      host: "https://test.test",
      params: {
        id: authenticationSession.id,
      },
      query: {
        provider: "apple",
        remember: true,
      },
    })
      .toString()
      .replace("https://test.test", "");

    const response = await request(server.callback()).get(url).expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://oidc-redirect.url");
  });

  test("should create new strategy session", async () => {
    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession(),
    );

    const response = await request(server.callback())
      .post(`/sessions/authentication/${authenticationSession.id}/strategy`)
      .send({
        email: "test@lindorm.io",
        strategy: AuthenticationStrategies.EMAIL_OTP,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      id: expect.any(String),
      display_code: null,
      expires_in: 31536000,
      input_key: "otp",
      input_length: 6,
      input_mode: "numeric",
      polling_required: false,
      qr_code: null,
      strategy_session_token: expect.any(String),
    });

    await expect(TEST_STRATEGY_SESSION_CACHE.find({ id: response.body.id })).resolves.not.toThrow();
  });

  test("should verify authentication code", async () => {
    const code = randomString(64);
    const { codeChallenge, codeChallengeMethod, codeVerifier } = getTestData();

    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession({
        code: await argon.encrypt(code),
        codeChallenge,
        codeChallengeMethod,
        confirmedIdentifiers: ["test@email.com", "+46701234567"],
        confirmedStrategies: [
          AuthenticationStrategies.EMAIL_OTP,
          AuthenticationStrategies.PHONE_OTP,
        ],
        status: SessionStatuses.CODE,
      }),
    );

    const response = await request(server.callback())
      .post(`/sessions/authentication/${authenticationSession.id}/verify`)
      .send({
        code: code,
        code_verifier: codeVerifier,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      authentication_confirmation_token: expect.any(String),
      expires_in: 60,
    });

    await expect(
      TEST_AUTHENTICATION_SESSION_CACHE.find({ id: authenticationSession.id }),
    ).rejects.toThrow(EntityNotFoundError);
  });
});
