import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { AuthenticationMethod } from "../../enum";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { SessionStatus } from "../../common";
import { argon } from "../../instance";
import { createTestAuthenticationSession } from "../../fixtures/entity";
import { getRandomString } from "@lindorm-io/core";
import { getTestData } from "../../fixtures/data";
import { server } from "../../server/server";
import {
  TEST_AUTHENTICATION_SESSION_CACHE,
  TEST_STRATEGY_SESSION_CACHE,
  setupIntegration,
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
      accessToken: "accessToken",
      expiresIn: 100,
      scope: ["scope"],
    });

  nock("https://communication.test.lindorm.io")
    .post("/internal/send/otp")
    .times(999)
    .reply(200, {});

  test("GET /:id", async () => {
    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession(),
    );

    const response = await request(server.callback())
      .get(`/sessions/authentication/${authenticationSession.id}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      allowed_methods: ["bank_id_se", "device_challenge", "email_link", "email_otp", "phone_otp"],
      email_hint: "test@lindorm.io",
      expires: "2022-01-01T08:00:00.000Z",
      phone_hint: "0701234567",
      prioritized_method: "bank_id_se",
      requested_methods: ["email_otp"],
      status: "pending",
    });
  });

  test("GET /:id - resolves code", async () => {
    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession({
        confirmedLevelOfAssurance: 3,
        confirmedMethods: [AuthenticationMethod.DEVICE_CHALLENGE],
        status: SessionStatus.CONFIRMED,
      }),
    );

    const response = await request(server.callback())
      .get(`/sessions/authentication/${authenticationSession.id}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      code: expect.any(String),
    });

    const found = await TEST_AUTHENTICATION_SESSION_CACHE.find({ id: authenticationSession.id });

    await expect(argon.assert(response.body.code, found.code)).resolves.not.toThrow();
  });

  test("POST /:id/strategy", async () => {
    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession(),
    );

    const response = await request(server.callback())
      .post(`/sessions/authentication/${authenticationSession.id}/strategy`)
      .send({
        email: "test@lindorm.io",
        method: AuthenticationMethod.EMAIL_OTP,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      id: expect.any(String),
      expires_in: 31536000,
      polling_required: false,
      strategy_session_token: expect.any(String),
    });

    await expect(TEST_STRATEGY_SESSION_CACHE.find({ id: response.body.id })).resolves.not.toThrow();
  });

  test("POST /:id/verify - with mfa and body", async () => {
    const code = getRandomString(64);
    const { codeChallenge, codeChallengeMethod, codeVerifier } = getTestData();

    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession({
        code: await argon.encrypt(code),
        codeChallenge,
        codeChallengeMethod,
        confirmedLevelOfAssurance: 3,
        confirmedMethods: [AuthenticationMethod.EMAIL_OTP, AuthenticationMethod.PHONE_OTP],
        redirectUri: null,
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

    expect(response.headers["set-cookie"]).toEqual([
      expect.stringMatching(/lindorm_io_authentication_mfa=\S+.+/),
    ]);

    await expect(
      TEST_AUTHENTICATION_SESSION_CACHE.find({ id: authenticationSession.id }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  test("POST /:id/verify - with redirect", async () => {
    const code = getRandomString(64);
    const { codeChallenge, codeChallengeMethod, codeVerifier } = getTestData();

    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession({
        code: await argon.encrypt(code),
        codeChallenge,
        codeChallengeMethod,
        confirmedLevelOfAssurance: 3,
        confirmedMethods: [AuthenticationMethod.EMAIL_OTP, AuthenticationMethod.PHONE_OTP],
        redirectUri: "https://redirect.uri/path",
        status: SessionStatus.CODE,
      }),
    );

    const response = await request(server.callback())
      .post(`/sessions/authentication/${authenticationSession.id}/verify`)
      .send({
        code: code,
        code_verifier: codeVerifier,
      })
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://redirect.uri");
    expect(location.pathname).toBe("/path");
    expect(location.searchParams.get("authentication_confirmation_token")).toStrictEqual(
      expect.any(String),
    );
    expect(location.searchParams.get("expires_in")).toBe("60");

    await expect(
      TEST_AUTHENTICATION_SESSION_CACHE.find({ id: authenticationSession.id }),
    ).rejects.toThrow(EntityNotFoundError);
  });
});
