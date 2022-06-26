import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { ChallengeStrategy, DeviceFactor } from "../common";
import { CryptoLayered } from "@lindorm-io/crypto";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { createTestDeviceLink } from "../fixtures/entity";
import { randomNumber, randomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";
import { server } from "../server/server";
import {
  getTestAccessToken,
  getTestChallengeConfirmationToken,
  setupIntegration,
  TEST_DEVICE_REPOSITORY,
} from "../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/device-links", () => {
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

  nock("https://vault.test.lindorm.io")
    .delete((uri) => uri.includes("/internal/vault"))
    .times(999)
    .reply(204);

  const crypto = new CryptoLayered({
    aes: { secret: salt },
    sha: { secret: salt },
  });

  beforeAll(setupIntegration);

  test("GET /", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(createTestDeviceLink({}));

    const deviceLink2 = await TEST_DEVICE_REPOSITORY.create(
      createTestDeviceLink({
        identityId: deviceLink.identityId,
        metadata: {
          ...deviceLink.metadata,
          macAddress: "E1:9A:09:75:46:93",
        },
        name: "My Xperia 7",
      }),
    );

    const accessToken = getTestAccessToken({
      subject: deviceLink.identityId,
    });

    const response = await request(server.callback())
      .get("/device-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      device_links: expect.arrayContaining([
        expect.objectContaining({
          id: deviceLink.id,
        }),
        expect.objectContaining({
          id: deviceLink2.id,
        }),
      ]),
    });
  });

  test("DELETE /:id", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(createTestDeviceLink());

    const accessToken = getTestAccessToken({
      subject: deviceLink.identityId,
    });

    await request(server.callback())
      .delete(`/device-links/${deviceLink.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    await expect(TEST_DEVICE_REPOSITORY.find({ id: deviceLink.id })).rejects.toThrow(
      EntityNotFoundError,
    );
  });

  test("GET /:id", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(
      createTestDeviceLink({
        biometry: await crypto.encrypt("secret"),
        pincode: await crypto.encrypt("123456"),
      }),
    );

    const accessToken = getTestAccessToken({
      subject: deviceLink.identityId,
    });

    const response = await request(server.callback())
      .get(`/device-links/${deviceLink.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      id: deviceLink.id,
      active: true,
      identity_id: deviceLink.identityId,
      installation_id: deviceLink.installationId,
      metadata: {
        brand: "Apple",
        build_id: "12A269",
        build_number: "89",
        mac_address: "0B:ED:A0:D5:5A:2D",
        model: "iPhone7,2",
        system_name: "iOS",
      },
      name: "Test DeviceLink Name",
      trusted: true,
      unique_id: deviceLink.uniqueId,
    });
  });

  test("PUT /:id/biometry", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(
      createTestDeviceLink({
        biometry: await crypto.encrypt("secret"),
        pincode: await crypto.encrypt("123456"),
      }),
    );

    const accessToken = getTestAccessToken({
      subject: deviceLink.identityId,
    });
    const challengeConfirmationToken = getTestChallengeConfirmationToken({
      claims: {
        deviceLinkId: deviceLink.id,
        factors: [DeviceFactor.POSSESSION, DeviceFactor.KNOWLEDGE],
        strategy: ChallengeStrategy.PINCODE,
      },
      sessionId: randomUUID(),
      subject: deviceLink.identityId,
    });

    await request(server.callback())
      .put(`/device-links/${deviceLink.id}/biometry`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        challengeConfirmationToken,
        biometry: randomString(128),
      })
      .expect(204);

    const result = await TEST_DEVICE_REPOSITORY.find({ id: deviceLink.id });

    expect(result.biometry).not.toBe(deviceLink.biometry);
  });

  test("PUT /:id/pincode", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(
      createTestDeviceLink({
        biometry: await crypto.encrypt("secret"),
        pincode: await crypto.encrypt("123456"),
      }),
    );

    const accessToken = getTestAccessToken({
      subject: deviceLink.identityId,
    });

    const challengeConfirmationToken = getTestChallengeConfirmationToken({
      claims: {
        deviceLinkId: deviceLink.id,
        factors: [DeviceFactor.POSSESSION, DeviceFactor.KNOWLEDGE],
        strategy: ChallengeStrategy.PINCODE,
      },
      sessionId: randomUUID(),
      subject: deviceLink.identityId,
    });

    await request(server.callback())
      .put(`/device-links/${deviceLink.id}/pincode`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        challengeConfirmationToken,
        pincode: randomNumber(6).toString().padStart(6, "0"),
      })
      .expect(204);

    const result = await TEST_DEVICE_REPOSITORY.find({ id: deviceLink.id });

    expect(result.pincode).not.toBe(deviceLink.pincode);
  });

  test("PUT /:id/trusted", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(
      await createTestDeviceLink({
        trusted: false,
      }),
    );

    const accessToken = getTestAccessToken({
      subject: deviceLink.identityId,
    });

    const challengeConfirmationToken = getTestChallengeConfirmationToken({
      claims: {
        deviceLinkId: deviceLink.id,
        factors: [DeviceFactor.POSSESSION, DeviceFactor.KNOWLEDGE],
        strategy: ChallengeStrategy.PINCODE,
      },
      sessionId: randomUUID(),
      subject: deviceLink.identityId,
    });

    await request(server.callback())
      .put(`/device-links/${deviceLink.id}/trusted`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        challengeConfirmationToken,
      })
      .expect(204);

    const result = await TEST_DEVICE_REPOSITORY.find({ id: deviceLink.id });

    expect(result.trusted).toBe(true);
  });
});
