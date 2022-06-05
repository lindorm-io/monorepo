import MockDate from "mockdate";
import { createMockRepository } from "@lindorm-io/mongo";
import { deleteDeviceLinkController } from "./delete-device-link";
import { destroyDeviceLinkCallback as _destroyDeviceLinkCallback } from "../../handler";
import { createTestDeviceLink } from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const destroyDeviceLinkCallback = _destroyDeviceLinkCallback as jest.Mock;

describe("deleteDeviceLinkController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      entity: {
        deviceLink: createTestDeviceLink(),
      },
      repository: {
        deviceLinkRepository: createMockRepository(createTestDeviceLink),
      },
    };

    destroyDeviceLinkCallback.mockResolvedValue(undefined);
  });

  test("should resolve and remove deviceLink", async () => {
    await expect(deleteDeviceLinkController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.deviceLinkRepository.destroy).toHaveBeenCalled();
  });
});
