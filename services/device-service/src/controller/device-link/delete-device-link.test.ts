import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { createTestDeviceLink } from "../../fixtures/entity";
import { destroyDeviceLinkCallback as _destroyDeviceLinkCallback } from "../../handler";
import { deleteDeviceLinkController } from "./delete-device-link";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const destroyDeviceLinkCallback = _destroyDeviceLinkCallback as jest.Mock;

describe("deleteDeviceLinkController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      entity: {
        deviceLink: createTestDeviceLink({
          identityId: "b799b044-16db-495a-b7e1-2cf3175d4b54",
        }),
      },
      mongo: {
        deviceLinkRepository: createMockMongoRepository(createTestDeviceLink),
      },
      token: {
        bearerToken: {
          subject: "b799b044-16db-495a-b7e1-2cf3175d4b54",
        },
      },
    };

    destroyDeviceLinkCallback.mockResolvedValue(undefined);
  });

  test("should resolve and remove deviceLink", async () => {
    await expect(deleteDeviceLinkController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.deviceLinkRepository.destroy).toHaveBeenCalled();
  });
});
