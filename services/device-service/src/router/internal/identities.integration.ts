import MockDate from "mockdate";
import request from "supertest";
import { createTestDeviceLink } from "../../fixtures/entity";
import { server } from "../../server/server";
import {
  TEST_DEVICE_REPOSITORY,
  getTestClientCredentials,
  setupIntegration,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/internal/identities", () => {
  beforeAll(setupIntegration);

  test("GET /:id/deviceLinks", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(createTestDeviceLink({}));

    const deviceLink2 = await TEST_DEVICE_REPOSITORY.create(
      createTestDeviceLink({
        identityId: deviceLink.identityId,
      }),
    );

    const deviceLink3 = await TEST_DEVICE_REPOSITORY.create(
      createTestDeviceLink({
        identityId: deviceLink.identityId,
      }),
    );

    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .get(`/internal/identities/${deviceLink.identityId}/deviceLinks`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      device_links: expect.arrayContaining([deviceLink.id, deviceLink2.id, deviceLink3.id]),
    });
  });
});
