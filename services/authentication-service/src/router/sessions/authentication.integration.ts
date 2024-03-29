import { TransformMode } from "@lindorm-io/axios";
import {
  AuthenticationMethod,
  AuthenticationStrategy,
  SessionStatus,
} from "@lindorm-io/common-enums";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { randomString } from "@lindorm-io/random";
import { createURL } from "@lindorm-io/url";
import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { StrategySession } from "../../entity";
import { mockFetchOauthAuthorizationSession } from "../../fixtures/axios";
import { getTestData } from "../../fixtures/data";
import { createTestAuthenticationSession } from "../../fixtures/entity";
import {
  TEST_AUTHENTICATION_SESSION_CACHE,
  TEST_STRATEGY_SESSION_CACHE,
  setupIntegration,
} from "../../fixtures/integration";
import { argon } from "../../instance";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessions/authentication", () => {
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

  nock("https://communication.test.lindorm.io").post("/admin/send/otp").times(999).reply(200, {});

  nock("https://oauth.test.lindorm.io")
    .get((uri) => uri.startsWith("/admin/sessions/authorization/"))
    .reply(200, mockFetchOauthAuthorizationSession());

  nock("https://federation.test.lindorm.io").post("/admin/sessions").times(999).reply(200, {
    redirect_to: "https://federation-redirect.url",
  });

  nock("https://federation.test.lindorm.io")
    .get((uri) => uri.startsWith("/admin/sessions"))
    .times(999)
    .reply(200, {
      identity_id: null,
      level_of_assurance: 3,
      provider: "apple",
    });

  nock("https://federation.test.lindorm.io")
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
        methods: [
          AuthenticationMethod.EMAIL,
          AuthenticationMethod.PHONE,
          AuthenticationMethod.DEVICE_LINK,
        ],
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
          hint: null,
          hint_type: "none",
          identifier_type: "none",
          method: "urn:lindorm:auth:method:device-link",
          rank: 1,
          recommended: false,
          required: true,
          strategies: [
            {
              strategy: "urn:lindorm:auth:strategy:device-challenge",
              weight: 900000,
            },
          ],
          weight: 900000,
        },
        {
          hint: "test@lindorm.io",
          hint_type: "email",
          identifier_type: "email",
          method: "urn:lindorm:auth:method:email",
          rank: 2,
          recommended: true,
          required: false,
          strategies: [
            {
              strategy: "urn:lindorm:auth:strategy:email-otp",
              weight: 750,
            },
            {
              strategy: "urn:lindorm:auth:strategy:email-code",
              weight: 250,
            },
          ],
          weight: 750,
        },
        {
          hint: "0701234567",
          hint_type: "phone",
          identifier_type: "phone",
          method: "urn:lindorm:auth:method:phone",
          rank: 3,
          recommended: true,
          required: false,
          strategies: [
            {
              strategy: "urn:lindorm:auth:strategy:phone-otp",
              weight: 500,
            },
            {
              strategy: "urn:lindorm:auth:strategy:phone-code",
              weight: 250,
            },
          ],
          weight: 500,
        },
      ],

      expires: "2022-01-01T08:00:00.000Z",
      mode: "oauth",
      federation_providers: ["apple", "google", "microsoft"],
      status: "pending",
    });
  });

  test("should return authentication code", async () => {
    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession({
        confirmedStrategies: [AuthenticationStrategy.DEVICE_CHALLENGE],
        status: SessionStatus.CONFIRMED,
      }),
    );

    const response = await request(server.callback())
      .get(`/sessions/authentication/${authenticationSession.id}/code`)
      .expect(200);

    expect(response.body).toStrictEqual({
      code: expect.any(String),
      mode: "oauth",
    });

    const found = await TEST_AUTHENTICATION_SESSION_CACHE.find({ id: authenticationSession.id });

    await expect(argon.assert(response.body.code, found.code!)).resolves.not.toThrow();
  });

  test("should resolve redirect to federation", async () => {
    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession(),
    );

    const url = createURL("/sessions/authentication/:id/federation", {
      host: "https://test.test",
      params: {
        id: authenticationSession.id,
      },
      query: {
        provider: "apple",
        remember: true,
      },
      queryCaseTransform: TransformMode.SNAKE,
    })
      .toString()
      .replace("https://test.test", "");

    const response = await request(server.callback()).get(url).expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://federation-redirect.url");
  });

  test("should create new strategy session", async () => {
    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession(),
    );

    const response = await request(server.callback())
      .post(`/sessions/authentication/${authenticationSession.id}/strategy`)
      .send({
        identifier: "test@lindorm.io",
        identifier_type: "email",
        strategy: AuthenticationStrategy.EMAIL_OTP,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      id: expect.any(String),
      acknowledge_code: null,
      confirm_key: "otp",
      confirm_length: 6,
      confirm_mode: "numeric",
      expires: "2022-01-01T08:00:00.000Z",
      polling_required: false,
      qr_code: null,
      strategy_session_token: expect.any(String),
      visual_hint: expect.any(String),
    });

    await expect(TEST_STRATEGY_SESSION_CACHE.find({ id: response.body.id })).resolves.toStrictEqual(
      expect.any(StrategySession),
    );
  });

  test("should reject authentication session", async () => {
    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession(),
    );

    await request(server.callback())
      .post(`/sessions/authentication/${authenticationSession.id}/reject`)
      .expect(204);

    await expect(
      TEST_AUTHENTICATION_SESSION_CACHE.find({ id: authenticationSession.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        status: "rejected",
      }),
    );
  });

  test("should verify authentication code", async () => {
    const code = randomString(64);
    const { codeChallenge, codeChallengeMethod, codeVerifier } = getTestData();

    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession({
        code: await argon.sign(code),
        codeChallenge,
        codeChallengeMethod,
        confirmedIdentifiers: ["test@email.com", "+46701234567"],
        confirmedStrategies: [AuthenticationStrategy.EMAIL_OTP, AuthenticationStrategy.PHONE_OTP],
        status: SessionStatus.CODE,
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
