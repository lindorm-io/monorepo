import MockDate from "mockdate";
import request from "supertest";
import { ChallengeStrategy } from "../common";
import { CryptoLayered } from "@lindorm-io/crypto";
import { getRandomNumber, getRandomString } from "@lindorm-io/core";
import { getTestChallengeSession, getTestDeviceLink } from "../test/entity";
import { server } from "../server/server";
import { randomUUID } from "crypto";
import {
  TEST_CHALLENGE_SESSION_CACHE,
  TEST_DEVICE_REPOSITORY,
  getTestChallengeSessionToken,
  setupIntegration,
  signTestChallenge,
} from "../test/integration";
import nock from "nock";

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
    .get((uri) => uri.includes("/internal/vault"))
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
      getTestDeviceLink({
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
      .set("x-device-unique-id", deviceLink.uniqueId)
      .set("x-fingerprint", "4f197712-0120-4654-99e7-828edc10b468")
      .send({
        client_id: "7bb4396b-5bad-4e6e-8edb-4f0f3c20e902",
        device_link_id: deviceLink.id,
        identity_id: deviceLink.identityId,
        nonce: getRandomString(16),
        payload: { integration: true },
        scopes: ["integration", "test"],
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      certificate_challenge: expect.any(String),
      challenge_session_token: expect.any(String),
      expires_in: 300,
      strategies: ["implicit", "biometry", "pincode"],
    });
  });

  test("POST /:id/confirm [ IMPLICIT ]", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(
      getTestDeviceLink({
        biometry: await crypto.encrypt("secret"),
        pincode: await crypto.encrypt("123456"),
      }),
    );
    const session = await TEST_CHALLENGE_SESSION_CACHE.create(
      getTestChallengeSession({
        id: randomUUID(),
        deviceLinkId: deviceLink.id,
      }),
    );
    const certificateVerifier = signTestChallenge(
      deviceLink.certificateMethod,
      session.certificateChallenge,
    );
    const challengeSessionToken = getTestChallengeSessionToken({
      sessionId: session.id,
    });

    const response = await request(server.callback())
      .post(`/challenges/${session.id}/confirm`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-unique-id", deviceLink.uniqueId)
      .set("x-fingerprint", "4f197712-0120-4654-99e7-828edc10b468")
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
    const biometry = getRandomString(128);

    const deviceLink = await TEST_DEVICE_REPOSITORY.create(
      getTestDeviceLink({
        biometry: await crypto.encrypt(biometry),
        pincode: await crypto.encrypt("123456"),
      }),
    );

    const session = await TEST_CHALLENGE_SESSION_CACHE.create(
      getTestChallengeSession({
        id: randomUUID(),
        deviceLinkId: deviceLink.id,
      }),
    );

    const certificateVerifier = signTestChallenge(
      deviceLink.certificateMethod,
      session.certificateChallenge,
    );

    const challengeSessionToken = getTestChallengeSessionToken({
      sessionId: session.id,
    });

    const response = await request(server.callback())
      .post(`/challenges/${session.id}/confirm`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-unique-id", deviceLink.uniqueId)
      .set("x-fingerprint", "4f197712-0120-4654-99e7-828edc10b468")
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
    const pincode = getRandomNumber(6).toString().padStart(6, "0");

    const deviceLink = await TEST_DEVICE_REPOSITORY.create(
      getTestDeviceLink({
        biometry: await crypto.encrypt("secret"),
        pincode: await crypto.encrypt(pincode),
      }),
    );

    const session = await TEST_CHALLENGE_SESSION_CACHE.create(
      getTestChallengeSession({
        id: randomUUID(),
        deviceLinkId: deviceLink.id,
      }),
    );

    const certificateVerifier = signTestChallenge(
      deviceLink.certificateMethod,
      session.certificateChallenge,
    );

    const challengeSessionToken = getTestChallengeSessionToken({
      sessionId: session.id,
    });

    const response = await request(server.callback())
      .post(`/challenges/${session.id}/confirm`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-unique-id", deviceLink.uniqueId)
      .set("x-fingerprint", "4f197712-0120-4654-99e7-828edc10b468")
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
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(getTestDeviceLink({}));

    const session = await TEST_CHALLENGE_SESSION_CACHE.create(
      getTestChallengeSession({
        id: randomUUID(),
        deviceLinkId: deviceLink.id,
      }),
    );

    const challengeSessionToken = getTestChallengeSessionToken({
      sessionId: session.id,
    });

    await request(server.callback())
      .post(`/challenges/${session.id}/reject`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-unique-id", deviceLink.uniqueId)
      .set("x-fingerprint", "4f197712-0120-4654-99e7-828edc10b468")
      .send({
        challenge_session_token: challengeSessionToken,
      })
      .expect(204);
  });
});
