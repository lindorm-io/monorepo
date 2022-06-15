import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { AuthenticationMethod } from "../../enum";
import { getRandomString } from "@lindorm-io/core";
import { server } from "../../server/server";
import {
  createTestAccount,
  createTestAuthenticationSession,
  createTestStrategySession,
} from "../../fixtures/entity";
import {
  TEST_ACCOUNT_REPOSITORY,
  TEST_AUTHENTICATION_SESSION_CACHE,
  TEST_STRATEGY_SESSION_CACHE,
  getTestChallengeConfirmationToken,
  getTestStrategySessionToken,
  setupIntegration,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessions/strategy", () => {
  beforeAll(setupIntegration);

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      accessToken: "accessToken",
      expiresIn: 100,
      scope: ["scope"],
    });

  nock("https://device.test.lindorm.io")
    .get((uri) => uri.startsWith("/internal/identities/") && uri.endsWith("/device-links"))
    .times(999)
    .reply(200, {
      device_links: [
        "895cf453-7d30-42c9-9a78-ae9314411812",
        "53144a9f-15ec-4ffa-a6a8-e193a4cf06c1",
      ],
    });

  nock("https://oauth.test.lindorm.io")
    .get((uri) => uri.startsWith("/internal/identities/") && uri.endsWith("/sessions"))
    .times(999)
    .reply(200, {
      sessions: [
        {
          id: "2cfbed4b-734d-4bad-8d85-ef3e75c866ba",
          levelOfAuthentication: 3,
        },
      ],
    });

  test("GET /:id", async () => {
    const strategySession = await TEST_STRATEGY_SESSION_CACHE.create(createTestStrategySession());

    const response = await request(server.callback())
      .get(`/sessions/strategy/${strategySession.id}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      expires: "2022-01-01T08:00:00.000Z",
      method: "email_otp",
      status: "pending",
    });
  });

  test("PUT /:id/confirm", async () => {
    const account = await TEST_ACCOUNT_REPOSITORY.create(createTestAccount());

    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession({
        identityId: null,
        loginSessionId: null,
        redirectUri: null,
        remember: false,
        requestedLevelOfAssurance: 1,
      }),
    );

    const strategySession = await TEST_STRATEGY_SESSION_CACHE.create(
      createTestStrategySession({
        authenticationSessionId: authenticationSession.id,
        method: AuthenticationMethod.DEVICE_CHALLENGE,
        nonce: getRandomString(16),
      }),
    );

    const challengeConfirmationToken = getTestChallengeConfirmationToken({
      nonce: strategySession.nonce,
      subject: account.id,
    });

    const strategySessionToken = getTestStrategySessionToken({
      subject: strategySession.id,
    });

    await request(server.callback())
      .put(`/sessions/strategy/${strategySession.id}/confirm`)
      .send({
        challenge_confirmation_token: challengeConfirmationToken,
        remember: true,
        strategy_session_token: strategySessionToken,
      })
      .expect(204);

    await expect(
      TEST_AUTHENTICATION_SESSION_CACHE.find({ id: authenticationSession.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        confirmedLevelOfAssurance: 3,
        confirmedMethods: ["device_challenge"],
        identityId: account.id,
        remember: true,
        status: "confirmed",
      }),
    );

    await expect(
      TEST_STRATEGY_SESSION_CACHE.find({ id: strategySession.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        status: "confirmed",
      }),
    );
  });

  test("PUT /:id/reject", async () => {
    const strategySession = await TEST_STRATEGY_SESSION_CACHE.create(createTestStrategySession());

    await request(server.callback())
      .put(`/sessions/strategy/${strategySession.id}/reject`)
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
