import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { createTestDeviceLink, createTestRdcSession } from "../fixtures/entity";
import { server } from "../server/server";
import { randomUUID } from "crypto";
import {
  getTestAccessToken,
  getTestChallengeConfirmationToken,
  getTestRdcToken,
  setupIntegration,
  TEST_DEVICE_REPOSITORY,
  TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE,
} from "../fixtures/integration";
import {
  ChallengeStrategy,
  PSD2Factor,
  SessionStatus,
  SubjectHint,
} from "@lindorm-io/common-types";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/rdc", () => {
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
      accessToken: "accessToken",
      expiresIn: 100,
      scope: ["scope"],
    });

  nock("https://communication.test.lindorm.io")
    .post("/admin/socket/emit")
    .times(999)
    .reply(200, {});

  nock("https://callback.lindorm.io").put("/confirm").times(999).reply(200, {});

  nock("https://callback.lindorm.io").delete("/reject").times(999).reply(200, {});

  test("should acknowledge rdc session", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(createTestDeviceLink());

    const session = await TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE.create(
      createTestRdcSession({
        deviceLinks: [deviceLink.id, randomUUID(), randomUUID()],
        expires: new Date("2021-01-01T08:15:00.000Z"),
        identityId: deviceLink.identityId,
      }),
    );

    const accessToken = getTestAccessToken({
      subject: deviceLink.identityId,
    });

    const response = await request(server.callback())
      .post(`/rdc/${session.id}/acknowledge`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-system-version", "V12")
      .set("x-device-unique-id", deviceLink.uniqueId)
      .expect(200);

    expect(response.body).toStrictEqual({
      id: session.id,
      challenge: {
        audiences: session.audiences,
        identity_id: deviceLink.identityId,
        nonce: session.nonce,
        payload: { token: true },
        scopes: [],
      },
      session: {
        expires: "2021-01-01T08:15:00.000Z",
        factors: 1,
        rdc_session_token: expect.any(String),
        status: SessionStatus.ACKNOWLEDGED,
      },
      template: {
        name: "template",
        parameters: { template: true },
      },
    });
  });

  test("should confirm rdc session", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(createTestDeviceLink());

    const session = await TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE.create(
      createTestRdcSession({
        deviceLinks: [deviceLink.id],
        identityId: deviceLink.identityId,
      }),
    );

    const rdcSessionToken = getTestRdcToken({
      nonce: session.nonce,
      payload: session.tokenPayload,
      scopes: session.scopes,
      session: session.id,
      subject: session.identityId!,
    });

    const challengeConfirmationToken = getTestChallengeConfirmationToken({
      claims: {
        deviceLinkId: deviceLink.id,
        factors: [PSD2Factor.POSSESSION, PSD2Factor.KNOWLEDGE],
        strategy: ChallengeStrategy.PINCODE,
      },
      nonce: session.nonce,
      payload: session.tokenPayload,
      scopes: session.scopes,
      session: session.id,
      sessionHint: "challenge",
      subject: session.identityId!,
      subjectHint: SubjectHint.IDENTITY,
    });

    const accessToken = getTestAccessToken({
      subject: deviceLink.identityId,
    });

    await request(server.callback())
      .post(`/rdc/${session.id}/confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-system-version", "V12")
      .set("x-device-unique-id", deviceLink.uniqueId)
      .send({
        challenge_confirmation_token: challengeConfirmationToken,
        rdcSession_token: rdcSessionToken,
      })
      .expect(204);
  });

  test("should reject rdc session", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(createTestDeviceLink());

    const session = await TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE.create(
      createTestRdcSession({
        deviceLinks: [deviceLink.id],
        identityId: deviceLink.identityId,
      }),
    );

    const rdcSessionToken = getTestRdcToken({
      nonce: session.nonce,
      payload: session.tokenPayload,
      scopes: session.scopes,
      session: session.id,
      sessionHint: "rdc",
      subject: session.identityId!,
      subjectHint: SubjectHint.IDENTITY,
    });

    const accessToken = getTestAccessToken({
      subject: deviceLink.identityId,
    });

    await request(server.callback())
      .post(`/rdc/${session.id}/reject`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-system-version", "V12")
      .set("x-device-unique-id", deviceLink.uniqueId)
      .send({
        rdcSession_token: rdcSessionToken,
      })
      .expect(204);
  });

  test("should resolve rdc session status", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(createTestDeviceLink());

    const session = await TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE.create(
      createTestRdcSession({
        deviceLinks: [deviceLink.id],
        identityId: deviceLink.identityId,
        status: SessionStatus.PENDING,
      }),
    );

    const response = await request(server.callback())
      .get(`/rdc/${session.id}/status`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-system-version", "V12")
      .set("x-device-unique-id", deviceLink.uniqueId)
      .expect(200);

    expect(response.body).toStrictEqual({
      status: "pending",
    });
  });
});
