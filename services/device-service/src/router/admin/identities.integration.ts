import MockDate from "mockdate";
import request from "supertest";
import { createTestDeviceLink } from "../../fixtures/entity";
import {
  getTestClientCredentials,
  setupIntegration,
  TEST_DEVICE_LINK_REPOSITORY,
} from "../../fixtures/integration";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/admin/identities", () => {
  beforeAll(setupIntegration);

  test("GET /:id/device-links", async () => {
    const deviceLink = await TEST_DEVICE_LINK_REPOSITORY.create(createTestDeviceLink({}));

    const deviceLink2 = await TEST_DEVICE_LINK_REPOSITORY.create(
      createTestDeviceLink({
        identityId: deviceLink.identityId,
      }),
    );

    const deviceLink3 = await TEST_DEVICE_LINK_REPOSITORY.create(
      createTestDeviceLink({
        identityId: deviceLink.identityId,
      }),
    );

    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .get(`/admin/identities/${deviceLink.identityId}/device-links`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      device_links: expect.arrayContaining([deviceLink.id, deviceLink2.id, deviceLink3.id]),
    });
  });
});
