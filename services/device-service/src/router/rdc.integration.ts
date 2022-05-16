import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { ChallengeStrategy, Factor } from "../enum";
import { SessionStatus } from "../common";
import { getTestDeviceLink, getTestRdcSession } from "../test/entity";
import { server } from "../server/server";
import { randomUUID } from "crypto";
import {
  getTestAccessToken,
  getTestChallengeConfirmationToken,
  getTestEdsToken,
  setupIntegration,
  TEST_DEVICE_REPOSITORY,
  TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE,
} from "../test/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("/rdc", () => {
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
    .post("/internal/socket/emit")
    .times(999)
    .reply(200, {});

  nock("https://callback.lindorm.io").put("/confirm").times(999).reply(200, {});

  nock("https://callback.lindorm.io").delete("/reject").times(999).reply(200, {});

  test("POST /:id/acknowledge", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(getTestDeviceLink());

    const session = await TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE.create(
      getTestRdcSession({
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
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-unique-id", deviceLink.uniqueId)
      .expect(200);

    expect(response.body).toStrictEqual({
      id: session.id,
      challenge: {
        client_id: session.clientId,
        identity_id: deviceLink.identityId,
        nonce: session.nonce,
        payload: { token: true },
        scopes: [],
      },
      session: {
        expires_in: 900,
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

  test("POST /:id/confirm", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(getTestDeviceLink());

    const session = await TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE.create(
      getTestRdcSession({
        deviceLinks: [deviceLink.id],
        identityId: deviceLink.identityId,
      }),
    );

    const rdcSessionToken = getTestEdsToken({
      nonce: session.nonce,
      payload: session.tokenPayload,
      scopes: session.scopes,
      sessionId: session.id,
      subject: session.identityId,
    });

    const challengeConfirmationToken = getTestChallengeConfirmationToken({
      claims: {
        deviceLinkId: deviceLink.id,
        factors: [Factor.POSSESSION, Factor.KNOWLEDGE],
        strategy: ChallengeStrategy.PINCODE,
      },
      nonce: session.nonce,
      payload: session.tokenPayload,
      scopes: session.scopes,
      subject: session.identityId,
    });

    const accessToken = getTestAccessToken({
      subject: deviceLink.identityId,
    });

    await request(server.callback())
      .post(`/rdc/${session.id}/confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-unique-id", deviceLink.uniqueId)
      .send({
        challenge_confirmation_token: challengeConfirmationToken,
        rdcSession_token: rdcSessionToken,
      })
      .expect(202);
  });

  test("POST /:id/reject", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(getTestDeviceLink());

    const session = await TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE.create(
      getTestRdcSession({
        deviceLinks: [deviceLink.id],
        identityId: deviceLink.identityId,
      }),
    );

    const rdcSessionToken = getTestEdsToken({
      nonce: session.nonce,
      payload: session.tokenPayload,
      scopes: session.scopes,
      sessionId: session.id,
      subject: session.identityId,
    });

    const accessToken = getTestAccessToken({
      subject: deviceLink.identityId,
    });

    await request(server.callback())
      .post(`/rdc/${session.id}/reject`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-unique-id", deviceLink.uniqueId)
      .send({
        rdcSession_token: rdcSessionToken,
      })
      .expect(202);
  });

  test("GET /:id/status", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(getTestDeviceLink());

    const session = await TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE.create(
      getTestRdcSession({
        deviceLinks: [deviceLink.id],
        identityId: deviceLink.identityId,
        status: SessionStatus.PENDING,
      }),
    );

    const response = await request(server.callback())
      .get(`/rdc/${session.id}/status`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-unique-id", deviceLink.uniqueId)
      .expect(200);

    expect(response.body).toStrictEqual({
      status: "pending",
    });
  });
});
