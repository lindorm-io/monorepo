import { ChallengeStrategy, PSD2Factor } from "@lindorm-io/common-enums";
import { CryptoLayered } from "@lindorm-io/crypto";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { randomNumber, randomString } from "@lindorm-io/random";
import { randomBytes, randomUUID } from "crypto";
import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { createTestDeviceLink } from "../fixtures/entity";
import {
  TEST_DEVICE_LINK_REPOSITORY,
  getTestAccessToken,
  getTestChallengeConfirmationToken,
  setupIntegration,
} from "../fixtures/integration";
import { server } from "../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/device-links", () => {
  const salt = randomBytes(16).toString("hex");

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

  nock("https://vault.test.lindorm.io")
    .get((uri) => uri.includes("/admin/vault"))
    .times(999)
    .reply(200, {
      data: {
        aes: salt,
        hmac: salt,
      },
    });

  nock("https://vault.test.lindorm.io")
    .delete((uri) => uri.includes("/admin/vault"))
    .times(999)
    .reply(204);

  const crypto = new CryptoLayered({
    aes: { secret: salt },
    hmac: { secret: salt },
  });

  beforeAll(setupIntegration);

  test("GET /", async () => {
    const deviceLink = await TEST_DEVICE_LINK_REPOSITORY.create(createTestDeviceLink({}));

    const deviceLink2 = await TEST_DEVICE_LINK_REPOSITORY.create(
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
    const deviceLink = await TEST_DEVICE_LINK_REPOSITORY.create(createTestDeviceLink());

    const accessToken = getTestAccessToken({
      subject: deviceLink.identityId,
    });

    await request(server.callback())
      .delete(`/device-links/${deviceLink.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    await expect(TEST_DEVICE_LINK_REPOSITORY.find({ id: deviceLink.id })).rejects.toThrow(
      EntityNotFoundError,
    );
  });

  test("GET /:id", async () => {
    const deviceLink = await TEST_DEVICE_LINK_REPOSITORY.create(
      createTestDeviceLink({
        biometry: await crypto.sign("secret"),
        pincode: await crypto.sign("123456"),
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
    const deviceLink = await TEST_DEVICE_LINK_REPOSITORY.create(
      createTestDeviceLink({
        biometry: await crypto.sign("secret"),
        pincode: await crypto.sign("123456"),
      }),
    );

    const accessToken = getTestAccessToken({
      subject: deviceLink.identityId,
    });
    const challengeConfirmationToken = getTestChallengeConfirmationToken({
      claims: {
        deviceLinkId: deviceLink.id,
        ext: {},
        factors: [PSD2Factor.POSSESSION, PSD2Factor.KNOWLEDGE],
        strategy: ChallengeStrategy.PINCODE,
      },
      session: randomUUID(),
      subject: deviceLink.identityId,
    });

    await request(server.callback())
      .put(`/device-links/${deviceLink.id}/biometry`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-system-version", "V12")
      .set("x-device-unique-id", deviceLink.uniqueId)
      .send({
        challengeConfirmationToken,
        biometry: randomString(128),
      })
      .expect(204);

    const result = await TEST_DEVICE_LINK_REPOSITORY.find({ id: deviceLink.id });

    expect(result.biometry).not.toBe(deviceLink.biometry);
  });

  test("PUT /:id/pincode", async () => {
    const deviceLink = await TEST_DEVICE_LINK_REPOSITORY.create(
      createTestDeviceLink({
        biometry: await crypto.sign("secret"),
        pincode: await crypto.sign("123456"),
      }),
    );

    const accessToken = getTestAccessToken({
      subject: deviceLink.identityId,
    });

    const challengeConfirmationToken = getTestChallengeConfirmationToken({
      claims: {
        deviceLinkId: deviceLink.id,
        ext: {},
        factors: [PSD2Factor.POSSESSION, PSD2Factor.KNOWLEDGE],
        strategy: ChallengeStrategy.PINCODE,
      },
      session: randomUUID(),
      subject: deviceLink.identityId,
    });

    await request(server.callback())
      .put(`/device-links/${deviceLink.id}/pincode`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-system-version", "V12")
      .set("x-device-unique-id", deviceLink.uniqueId)
      .send({
        challengeConfirmationToken,
        pincode: randomNumber(6).toString().padStart(6, "0"),
      })
      .expect(204);

    const result = await TEST_DEVICE_LINK_REPOSITORY.find({ id: deviceLink.id });

    expect(result.pincode).not.toBe(deviceLink.pincode);
  });

  test("PUT /:id/trusted", async () => {
    const deviceLink = await TEST_DEVICE_LINK_REPOSITORY.create(
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
        ext: {},
        factors: [PSD2Factor.POSSESSION, PSD2Factor.KNOWLEDGE],
        strategy: ChallengeStrategy.PINCODE,
      },
      session: randomUUID(),
      subject: deviceLink.identityId,
    });

    await request(server.callback())
      .put(`/device-links/${deviceLink.id}/trusted`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-device-installation-id", deviceLink.installationId)
      .set("x-device-ip", "127.0.0.1")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-name", "Test DeviceLink Name")
      .set("x-device-system-version", "V12")
      .set("x-device-unique-id", deviceLink.uniqueId)
      .send({
        challengeConfirmationToken,
      })
      .expect(204);

    const result = await TEST_DEVICE_LINK_REPOSITORY.find({ id: deviceLink.id });

    expect(result.trusted).toBe(true);
  });
});
