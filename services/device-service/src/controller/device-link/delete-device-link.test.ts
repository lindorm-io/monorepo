import MockDate from "mockdate";
import { deleteDeviceLinkController } from "./delete-device-link";
import { getTestDeviceLink } from "../../test/entity";
import { destroyDeviceLinkCallback as _destroyDeviceLinkCallback } from "../../handler";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const destroyDeviceLinkCallback = _destroyDeviceLinkCallback as jest.Mock;

describe("deleteDeviceLinkController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      entity: {
        deviceLink: await getTestDeviceLink(),
      },
      repository: {
        deviceLinkRepository: {
          destroy: jest.fn(),
        },
      },
    };

    destroyDeviceLinkCallback.mockResolvedValue(undefined);
  });

  test("should resolve and remove deviceLink", async () => {
    await expect(deleteDeviceLinkController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(ctx.repository.deviceLinkRepository.destroy).toHaveBeenCalled();
  });
});
