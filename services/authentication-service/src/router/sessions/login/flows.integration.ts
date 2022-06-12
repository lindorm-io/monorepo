import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { FlowSession } from "../../../entity";
import { FlowType } from "../../../enum";
import { SessionStatus } from "../../../common";
import { argon } from "../../../instance";
import { createTestLoginSession } from "../../../fixtures/entity";
import { getRandomNumber } from "@lindorm-io/core";
import { server } from "../../../server/server";
import {
  getTestFlowSessionToken,
  setupIntegration,
  TEST_FLOW_SESSION_CACHE,
  TEST_LOGIN_SESSION_CACHE,
} from "../../../fixtures/integration";
import { randomUUID } from "crypto";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessions/login/flows", () => {
  beforeAll(setupIntegration);

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      access_token: "accessToken",
      expires_in: 100,
      scope: ["scope"],
    });

  nock("https://communication.test.lindorm.io").post("/internal/send/otp").times(999).reply(204);

  nock("https://identity.test.lindorm.io")
    .post("/internal/identifiers/authenticate")
    .times(999)
    .reply(200, {
      identity_id: "29f3dcca-ab2b-4cba-b62e-e9df593cfc3f",
    });

  nock("https://vault.test.lindorm.io").post("/internal/vault").times(999).reply(204);

  test("POST /", async () => {
    const loginSession = await TEST_LOGIN_SESSION_CACHE.create(
      createTestLoginSession({
        remember: false,
      }),
    );

    const response = await request(server.callback())
      .post("/sessions/login/flows")
      .set("Cookie", [
        `lindorm_io_authentication_login_session=${loginSession.id}; path=/; domain=https://authentication.test.lindorm.io; samesite=none`,
      ])
      .send({
        email: "email@lindorm.io",
        flow_type: FlowType.EMAIL_OTP,
        remember: true,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      id: expect.any(String),
      flow_token: expect.any(String),
      polling_required: false,
    });

    await expect(TEST_LOGIN_SESSION_CACHE.find({ id: loginSession.id })).resolves.toStrictEqual(
      expect.objectContaining({
        remember: true,
      }),
    );
  });

  test("PUT /:id/confirm", async () => {
    const otp = getRandomNumber(6).toString();

    const loginSession = await TEST_LOGIN_SESSION_CACHE.create(
      createTestLoginSession({
        identityId: null,
      }),
    );

    const flowSession = await TEST_FLOW_SESSION_CACHE.create(
      new FlowSession({
        email: "test@lindorm.io",
        expires: new Date("2022-01-01T08:00:00.000Z"),
        loginSessionId: loginSession.id,
        otp: await argon.encrypt(otp),
        status: SessionStatus.PENDING,
        type: FlowType.EMAIL_OTP,
      }),
    );

    const flowToken = getTestFlowSessionToken({
      sessionId: flowSession.id,
      subject: flowSession.id,
    });

    await request(server.callback())
      .put(`/sessions/login/flows/${flowSession.id}/confirm`)
      .send({
        flow_token: flowToken,
        otp,
      })
      .expect(204);

    await expect(TEST_LOGIN_SESSION_CACHE.find({ id: loginSession.id })).resolves.toStrictEqual(
      expect.objectContaining({
        allowedFlows: [
          "bank_id_se",
          "phone_otp",
          "rdc_qr_code",
          "session_accept_with_code",
          "session_otp",
          "webauthn",
        ],
        amrValues: ["email_otp"],
        levelOfAssurance: 2,
      }),
    );
  });

  test("PUT /:id/reject", async () => {
    const loginSession = await TEST_LOGIN_SESSION_CACHE.create(
      createTestLoginSession({
        identityId: null,
      }),
    );

    const flowSession = await TEST_FLOW_SESSION_CACHE.create(
      new FlowSession({
        email: "test@lindorm.io",
        expires: new Date("2022-01-01T08:00:00.000Z"),
        loginSessionId: loginSession.id,
        status: SessionStatus.PENDING,
        type: FlowType.EMAIL_OTP,
      }),
    );

    const flowToken = getTestFlowSessionToken({
      sessionId: flowSession.id,
      subject: flowSession.id,
    });

    await request(server.callback())
      .put(`/sessions/login/flows/${flowSession.id}/reject`)
      .send({
        flow_token: flowToken,
      })
      .expect(204);

    await expect(TEST_FLOW_SESSION_CACHE.find({ id: flowSession.id })).resolves.toStrictEqual(
      expect.objectContaining({
        status: "rejected",
      }),
    );
  });

  test("GET /:id/status", async () => {
    const flowSession = await TEST_FLOW_SESSION_CACHE.create(
      new FlowSession({
        email: "test@lindorm.io",
        expires: new Date("2022-01-01T08:00:00.000Z"),
        loginSessionId: randomUUID(),
        status: SessionStatus.PENDING,
        type: FlowType.EMAIL_OTP,
      }),
    );

    const response = await request(server.callback())
      .get(`/sessions/login/flows/${flowSession.id}/status`)
      .expect(200);

    expect(response.body).toStrictEqual({ status: "pending" });
  });
});
