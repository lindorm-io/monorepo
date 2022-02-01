import MockDate from "mockdate";
import { removeDeviceLinkController } from "./remove";
import { getTestDeviceLink } from "../../test/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("removeDeviceLinkController", () => {
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
  });

  test("should resolve and remove deviceLink", async () => {
    await expect(removeDeviceLinkController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(ctx.repository.deviceLinkRepository.destroy).toHaveBeenCalled();
  });
});
