import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { CryptoLayered } from "@lindorm-io/crypto";
import { createTestChallengeSession, createTestDeviceLink } from "../fixtures/entity";
import { randomNumber, randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { server } from "../server/server";
import { ChallengeStrategy } from "@lindorm-io/common-types";
import {
  getTestChallengeSessionToken,
  setupIntegration,
  signTestChallenge,
  TEST_CHALLENGE_SESSION_CACHE,
  TEST_DEVICE_REPOSITORY,
} from "../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/challenges", () => {
  const salt =
    "84s8VNdOtIvwL6KvNd28YktehfPhwGy0xObf7c7yr6Vz3XwH3CA9aOi7rSYKhPICaTukA0qqSzVhm1WW1L48YvpYD9OLAaNFqSAy6VIdA3NF096aBoawvt2boQkHF5tC";

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      accessToken: "accessToken",
      expiresIn: 100,
      scope: ["scope"],
    });

  nock("https://vault.test.lindorm.io")
    .get((uri) => uri.includes("/admin/vault"))
    .times(999)
    .reply(200, {
      data: {
        aes: salt,
        sha: salt,
      },
    });

  const crypto = new CryptoLayered({
    aes: { secret: salt },
    sha: { secret: salt },
  });

  beforeAll(setupIntegration);

  test("POST /", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(
      createTestDeviceLink({
        biometry: await crypto.encrypt("secret"),
        pincode: await crypto.encrypt("123456"),
      }),
    );

    const response = await request(server.callback())
      .post("/challenges")
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-system-version", "V12")
      .set("x-device-unique-id", deviceLink.uniqueId)
      .send({
        audiences: ["7bb4396b-5bad-4e6e-8edb-4f0f3c20e902", "d7cce9c2-0e6e-448b-a65f-f120cd2ffd32"],
        device_link_id: deviceLink.id,
        identity_id: deviceLink.identityId,
        nonce: randomString(16),
        payload: { integration: true },
        scopes: ["integration", "test"],
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      certificate_challenge: expect.any(String),
      challenge_session_id: expect.any(String),
      challenge_session_token: expect.any(String),
      expires_in: 300,
      strategies: ["implicit", "biometry", "pincode"],
    });
  });

  test("POST /:id/confirm [ IMPLICIT ]", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(
      createTestDeviceLink({
        biometry: await crypto.encrypt("secret"),
        pincode: await crypto.encrypt("123456"),
      }),
    );
    const session = await TEST_CHALLENGE_SESSION_CACHE.create(
      createTestChallengeSession({
        id: randomUUID(),
        deviceLinkId: deviceLink.id,
      }),
    );
    const certificateVerifier = signTestChallenge(
      deviceLink.certificateMethod,
      session.certificateChallenge,
    );
    const challengeSessionToken = getTestChallengeSessionToken({
      session: session.id,
    });

    const response = await request(server.callback())
      .post(`/challenges/${session.id}/confirm`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-system-version", "V12")
      .set("x-device-unique-id", deviceLink.uniqueId)
      .send({
        certificate_verifier: certificateVerifier,
        challenge_session_token: challengeSessionToken,
        strategy: ChallengeStrategy.IMPLICIT,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      challenge_confirmation_token: expect.any(String),
      expires_in: 300,
    });
  });

  test("POST /:id/confirm [ BIOMETRY ]", async () => {
    const biometry = randomString(128);

    const deviceLink = await TEST_DEVICE_REPOSITORY.create(
      createTestDeviceLink({
        biometry: await crypto.encrypt(biometry),
        pincode: await crypto.encrypt("123456"),
      }),
    );

    const session = await TEST_CHALLENGE_SESSION_CACHE.create(
      createTestChallengeSession({
        id: randomUUID(),
        deviceLinkId: deviceLink.id,
      }),
    );

    const certificateVerifier = signTestChallenge(
      deviceLink.certificateMethod,
      session.certificateChallenge,
    );

    const challengeSessionToken = getTestChallengeSessionToken({
      session: session.id,
    });

    const response = await request(server.callback())
      .post(`/challenges/${session.id}/confirm`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-system-version", "V12")
      .set("x-device-unique-id", deviceLink.uniqueId)
      .send({
        certificate_verifier: certificateVerifier,
        challenge_session_token: challengeSessionToken,
        strategy: ChallengeStrategy.BIOMETRY,
        biometry,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      challenge_confirmation_token: expect.any(String),
      expires_in: 300,
    });
  });

  test("POST /:id/confirm [ PINCODE ]", async () => {
    const pincode = randomNumber(6).toString().padStart(6, "0");

    const deviceLink = await TEST_DEVICE_REPOSITORY.create(
      createTestDeviceLink({
        biometry: await crypto.encrypt("secret"),
        pincode: await crypto.encrypt(pincode),
      }),
    );

    const session = await TEST_CHALLENGE_SESSION_CACHE.create(
      createTestChallengeSession({
        id: randomUUID(),
        deviceLinkId: deviceLink.id,
      }),
    );

    const certificateVerifier = signTestChallenge(
      deviceLink.certificateMethod,
      session.certificateChallenge,
    );

    const challengeSessionToken = getTestChallengeSessionToken({
      session: session.id,
    });

    const response = await request(server.callback())
      .post(`/challenges/${session.id}/confirm`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-system-version", "V12")
      .set("x-device-unique-id", deviceLink.uniqueId)
      .send({
        certificate_verifier: certificateVerifier,
        challenge_session_token: challengeSessionToken,
        strategy: ChallengeStrategy.PINCODE,
        pincode,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      challenge_confirmation_token: expect.any(String),
      expires_in: 300,
    });
  });

  test("POST /:id/reject", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(createTestDeviceLink({}));

    const session = await TEST_CHALLENGE_SESSION_CACHE.create(
      createTestChallengeSession({
        id: randomUUID(),
        deviceLinkId: deviceLink.id,
      }),
    );

    const challengeSessionToken = getTestChallengeSessionToken({
      session: session.id,
    });

    await request(server.callback())
      .post(`/challenges/${session.id}/reject`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-system-version", "V12")
      .set("x-device-unique-id", deviceLink.uniqueId)
      .send({
        challenge_session_token: challengeSessionToken,
      })
      .expect(204);
  });
});
