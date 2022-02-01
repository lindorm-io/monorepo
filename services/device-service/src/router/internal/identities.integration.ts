import MockDate from "mockdate";
import request from "supertest";
import { getTestDeviceLink } from "../../test/entity";
import { koa } from "../../server/koa";
import {
  TEST_DEVICE_REPOSITORY,
  getTestClientCredentials,
  setupIntegration,
} from "../../test/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("/internal/identities", () => {
  beforeAll(setupIntegration);

  test("GET /:id/deviceLinks", async () => {
    const deviceLink = await TEST_DEVICE_REPOSITORY.create(getTestDeviceLink({}));

    const deviceLink2 = await TEST_DEVICE_REPOSITORY.create(
      getTestDeviceLink({
        identityId: deviceLink.identityId,
      }),
    );

    const deviceLink3 = await TEST_DEVICE_REPOSITORY.create(
      getTestDeviceLink({
        identityId: deviceLink.identityId,
      }),
    );

    const clientCredentials = getTestClientCredentials();

    const response = await request(koa.callback())
      .get(`/internal/identities/${deviceLink.identityId}/deviceLinks`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      device_links: expect.arrayContaining([deviceLink.id, deviceLink2.id, deviceLink3.id]),
    });
  });
});
