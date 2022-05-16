import MockDate from "mockdate";
import request from "supertest";
import { CertificateMethod } from "../enum";
import { SessionStatus } from "../common";
import { getRandomNumber, getRandomString } from "@lindorm-io/core";
import { getTestEnrolmentSession } from "../test/entity";
import { server } from "../server/server";
import { randomUUID } from "crypto";
import {
  getTestAccessToken,
  getTestEnrolmentSessionToken,
  setupIntegration,
  signTestChallenge,
  TEST_ENROLMENT_SESSION_CACHE,
} from "../test/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("/enrolments", () => {
  beforeAll(setupIntegration);

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
      .set("x-device-unique-id", "27a10522a6994bbca0e1fc666804b350")
      .set("x-fingerprint", "4f197712-0120-4654-99e7-828edc10b468")
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
      getTestEnrolmentSession({
        status: SessionStatus.SKIP,
      }),
    );
    const certificateVerifier = signTestChallenge(
      session.certificateMethod,
      session.certificateChallenge,
    );
    const enrolmentSessionToken = getTestEnrolmentSessionToken({
      sessionId: session.id,
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
      .set("x-device-unique-id", "27a10522a6994bbca0e1fc666804b350")
      .set("x-fingerprint", "4f197712-0120-4654-99e7-828edc10b468")
      .send({
        certificate_verifier: certificateVerifier,
        enrolment_session_token: enrolmentSessionToken,
        biometry: getRandomString(128),
        pincode: getRandomNumber(6).toString().padStart(6, "0"),
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
    const session = await TEST_ENROLMENT_SESSION_CACHE.create(getTestEnrolmentSession());
    const enrolmentSessionToken = getTestEnrolmentSessionToken({
      sessionId: session.id,
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
      .set("x-device-unique-id", "27a10522a6994bbca0e1fc666804b350")
      .set("x-fingerprint", "4f197712-0120-4654-99e7-828edc10b468")
      .send({
        enrolment_session_token: enrolmentSessionToken,
      })
      .expect(200);
  });

  test("POST /:id/status", async () => {
    const session = await TEST_ENROLMENT_SESSION_CACHE.create(
      getTestEnrolmentSession({
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
      .set("x-device-unique-id", "27a10522a6994bbca0e1fc666804b350")
      .set("x-fingerprint", "4f197712-0120-4654-99e7-828edc10b468")
      .expect(200);

    expect(response.body).toStrictEqual({
      status: "pending",
    });
  });
});
