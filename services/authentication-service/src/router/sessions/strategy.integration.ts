import { AuthenticationStrategy, SessionStatus } from "@lindorm-io/common-enums";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import {
  createTestAccount,
  createTestAuthenticationSession,
  createTestStrategySession,
} from "../../fixtures/entity";
import {
  TEST_ACCOUNT_REPOSITORY,
  TEST_ARGON,
  TEST_AUTHENTICATION_SESSION_CACHE,
  TEST_STRATEGY_SESSION_CACHE,
  getTestAccessToken,
  getTestChallengeConfirmationToken,
  getTestStrategySessionToken,
  setupIntegration,
} from "../../fixtures/integration";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessions/strategy", () => {
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

  nock("https://device.test.lindorm.io")
    .get((uri) => uri.startsWith("/admin/identities/") && uri.endsWith("/device-links"))
    .times(999)
    .reply(200, {
      device_links: [
        "895cf453-7d30-42c9-9a78-ae9314411812",
        "53144a9f-15ec-4ffa-a6a8-e193a4cf06c1",
      ],
    });

  nock("https://oauth.test.lindorm.io")
    .get((uri) => uri.startsWith("/admin/identities/") && uri.endsWith("/sessions"))
    .times(999)
    .reply(200, {
      sessions: [
        {
          id: "2cfbed4b-734d-4bad-8d85-ef3e75c866ba",
          client: {
            logo_uri: "https://test.client.com/logo.png",
            name: "Test Client",
            tenant: "Test Tenant",
            type: "public",
          },
          adjustedAccessLevel: 1,
          latestAuthentication: "2020-01-01T01:00:00.000Z",
          levelOfAssurance: 4,
          metadata: {},
          methods: ["email"],
          scopes: ["openid", "email"],
          type: "access",
          levelOfAuthentication: 3,
        },
      ],
    });

  test("should return strategy session data", async () => {
    const strategySession = await TEST_STRATEGY_SESSION_CACHE.create(createTestStrategySession());

    const response = await request(server.callback())
      .get(`/sessions/strategy/${strategySession.id}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      expires: "2022-01-01T08:00:00.000Z",
      strategy: AuthenticationStrategy.EMAIL_OTP,
      status: "pending",
    });
  });

  test("should acknowledge strategy session", async () => {
    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession(),
    );
    const strategySession = await TEST_STRATEGY_SESSION_CACHE.create(
      createTestStrategySession({
        authenticationSessionId: authenticationSession.id,
        secret: await TEST_ARGON.sign("secret"),
        strategy: AuthenticationStrategy.SESSION_QR_CODE,
      }),
    );

    const identityId = randomUUID();
    const accessToken = getTestAccessToken({ subject: identityId });

    const response = await request(server.callback())
      .get(`/sessions/strategy/${strategySession.id}/acknowledge`)
      .query({ acknowledge_code: "secret" })
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      code: expect.any(String),
      strategy_session_token: expect.any(String),
    });

    await expect(
      TEST_STRATEGY_SESSION_CACHE.find({ id: strategySession.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        secret: expect.any(String),
        identityId,
        status: SessionStatus.ACKNOWLEDGED,
      }),
    );
  });

  test("should confirm strategy session", async () => {
    const account = await TEST_ACCOUNT_REPOSITORY.create(createTestAccount());

    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession({
        allowedStrategies: [AuthenticationStrategy.DEVICE_CHALLENGE],
        identityId: account.id,
        remember: false,
        requiredLevelOfAssurance: 4,
      }),
    );

    const strategySession = await TEST_STRATEGY_SESSION_CACHE.create(
      createTestStrategySession({
        authenticationSessionId: authenticationSession.id,
        strategy: AuthenticationStrategy.DEVICE_CHALLENGE,
      }),
    );

    const challengeConfirmationToken = getTestChallengeConfirmationToken({
      nonce: strategySession.nonce,
      subject: account.id,
    });

    const strategySessionToken = getTestStrategySessionToken({
      session: strategySession.id,
    });

    await request(server.callback())
      .post(`/sessions/strategy/${strategySession.id}/confirm`)
      .send({
        challenge_confirmation_token: challengeConfirmationToken,
        strategy_session_token: strategySessionToken,
        remember: true,
        sso: true,
      })
      .expect(204);

    await expect(
      TEST_AUTHENTICATION_SESSION_CACHE.find({ id: authenticationSession.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        allowedStrategies: [
          AuthenticationStrategy.EMAIL_CODE,
          AuthenticationStrategy.EMAIL_OTP,
          AuthenticationStrategy.PHONE_OTP,
          AuthenticationStrategy.TIME_BASED_OTP,
        ],
        confirmedStrategies: [AuthenticationStrategy.DEVICE_CHALLENGE],
        identityId: account.id,
        remember: true,
        status: "pending",
      }),
    );

    await expect(
      TEST_STRATEGY_SESSION_CACHE.find({ id: strategySession.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        status: SessionStatus.CONFIRMED,
      }),
    );
  });

  test("should reject strategy session", async () => {
    const strategySession = await TEST_STRATEGY_SESSION_CACHE.create(createTestStrategySession());

    await request(server.callback())
      .post(`/sessions/strategy/${strategySession.id}/reject`)
      .expect(204);

    await expect(
      TEST_STRATEGY_SESSION_CACHE.find({ id: strategySession.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        status: "rejected",
      }),
    );
  });
});
