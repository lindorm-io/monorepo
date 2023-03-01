import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { randomNumber, randomString } from "@lindorm-io/random";
import { createTestEnrolmentSession } from "../fixtures/entity";
import { server } from "../server/server";
import { randomUUID } from "crypto";
import { CertificateMethod, SessionStatus } from "@lindorm-io/common-types";
import {
  getTestAccessToken,
  getTestEnrolmentSessionToken,
  setupIntegration,
  signTestChallenge,
  TEST_ENROLMENT_SESSION_CACHE,
} from "../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/enrolments", () => {
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

  nock("https://vault.test.lindorm.io").post("/admin/vault").times(999).reply(201);

  test("POST /", async () => {
    const accessToken = getTestAccessToken({
      subject: randomUUID(),
    });

    const response = await request(server.callback())
      .post("/enrolments")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-installation-id", "12be09f5-fcd4-438f-9b5d-dc1fb11e5e75")
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-system-version", "V12")
      .set("x-device-unique-id", "27a10522a6994bbca0e1fc666804b350")
      .send({
        brand: "brand",
        build_id: "buildId",
        build_number: "buildNumber",
        certificate_method: CertificateMethod.SHA384,
        mac_address: "4A:E2:BD:16:8F:5A",
        model: "model",
        public_key:
          "-----BEGIN RSA PUBLIC KEY-----\n" +
          "MIGJAoGBAKdVz2lIbQi1YU3Z0qRizpV9gAMW9Kmwms4aP+r7CKcu4w9/fMcV4v6P\n" +
          "zYHwnjvTEZ6gSqtxcpwT6EgBAgxFolqjeInOis2I+tcfxcShwcfMZ/E7kgktP15w\n" +
          "dsAFDTzmso9VtnBNgbt8afNea1nK25Fa+Zq+gztxkI5pkw1WFm4FAgMBAAE=\n" +
          "-----END RSA PUBLIC KEY-----\n",
        system_name: "systemName",
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      certificate_challenge: expect.any(String),
      enrolment_session_id: expect.any(String),
      enrolment_session_token: expect.any(String),
      expires_in: 900,
      external_challenge_required: false,
    });
  });

  test("POST /:id/confirm", async () => {
    const session = await TEST_ENROLMENT_SESSION_CACHE.create(
      createTestEnrolmentSession({
        status: SessionStatus.SKIP,
      }),
    );
    const certificateVerifier = signTestChallenge(
      session.certificateMethod,
      session.certificateChallenge,
    );
    const enrolmentSessionToken = getTestEnrolmentSessionToken({
      session: session.id,
      subject: session.identityId,
    });
    const accessToken = getTestAccessToken({
      subject: session.identityId,
    });

    const response = await request(server.callback())
      .post(`/enrolments/${session.id}/confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-installation-id", "12be09f5-fcd4-438f-9b5d-dc1fb11e5e75")
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-system-version", "V12")
      .set("x-device-unique-id", "27a10522a6994bbca0e1fc666804b350")
      .send({
        certificate_verifier: certificateVerifier,
        enrolment_session_token: enrolmentSessionToken,
        biometry: randomString(128),
        pincode: randomNumber(6).toString().padStart(6, "0"),
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      challenge_confirmation_token: expect.any(String),
      device_link_id: expect.any(String),
      expires_in: 300,
      trusted: true,
    });
  });

  test("POST /:id/reject", async () => {
    const session = await TEST_ENROLMENT_SESSION_CACHE.create(createTestEnrolmentSession());
    const enrolmentSessionToken = getTestEnrolmentSessionToken({
      session: session.id,
      subject: session.identityId,
    });
    const accessToken = getTestAccessToken({
      subject: session.identityId,
    });

    await request(server.callback())
      .post(`/enrolments/${session.id}/reject`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-installation-id", "12be09f5-fcd4-438f-9b5d-dc1fb11e5e75")
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-system-version", "V12")
      .set("x-device-unique-id", "27a10522a6994bbca0e1fc666804b350")
      .send({
        enrolment_session_token: enrolmentSessionToken,
      })
      .expect(204);
  });

  test("GET /:id/status", async () => {
    const session = await TEST_ENROLMENT_SESSION_CACHE.create(
      createTestEnrolmentSession({
        status: SessionStatus.PENDING,
      }),
    );
    const accessToken = getTestAccessToken({
      subject: session.identityId,
    });

    const response = await request(server.callback())
      .get(`/enrolments/${session.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-installation-id", "12be09f5-fcd4-438f-9b5d-dc1fb11e5e75")
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-system-version", "V12")
      .set("x-device-unique-id", "27a10522a6994bbca0e1fc666804b350")
      .expect(200);

    expect(response.body).toStrictEqual({
      status: "pending",
    });
  });
});
