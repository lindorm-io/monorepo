import { randomUUID } from "crypto";
import MockDate from "mockdate";
import request from "supertest";
import { createTestDeviceLink, createTestRdcSession } from "../fixtures/entity";
import {
  TEST_DEVICE_LINK_REPOSITORY,
  TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE,
  getTestAccessToken,
  setupIntegration,
} from "../fixtures/integration";
import { server } from "../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/identities", () => {
  beforeAll(setupIntegration);

  test("should resolve pending sessions", async () => {
    const deviceLink = await TEST_DEVICE_LINK_REPOSITORY.create(createTestDeviceLink());
    const session1 = await TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE.create(
      createTestRdcSession({
        deviceLinks: [deviceLink.id, randomUUID(), randomUUID()],
        expires: new Date("2021-01-01T08:15:00.000Z"),
        identityId: deviceLink.identityId,
      }),
    );
    const session2 = await TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE.create(
      createTestRdcSession({
        deviceLinks: [deviceLink.id, randomUUID(), randomUUID()],
        expires: new Date("2021-01-01T08:20:00.000Z"),
        identityId: deviceLink.identityId,
      }),
    );
    const accessToken = getTestAccessToken({
      subject: deviceLink.identityId,
    });

    const response = await request(server.callback())
      .get(`/identities/${deviceLink.identityId}/rdc/pending`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-client-id", "a3a90c66-c7b6-4ffe-ba04-c1f9de429f04")
      .set("x-device-link-id", deviceLink.id)
      .set("x-device-link-installation-id", deviceLink.installationId)
      .set("x-device-link-unique-id", deviceLink.uniqueId)
      .expect(200);

    expect(response.body).toStrictEqual({
      sessions: [
        {
          id: session2.id,
          expires: "2021-01-01T08:20:00.000Z",
        },
        {
          id: session1.id,
          expires: "2021-01-01T08:15:00.000Z",
        },
      ],
    });
  });
});
