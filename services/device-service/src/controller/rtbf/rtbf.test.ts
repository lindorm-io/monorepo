import { rtbfController } from "./rtbf";
import { destroyDeviceLinkCallback as _destroyDeviceLinkCallback } from "../../handler";
import { getTestDeviceLink } from "../../test/entity";

jest.mock("../../handler");

const destroyDeviceLinkCallback = _destroyDeviceLinkCallback as jest.Mock;

describe("rtbfController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      repository: {
        deviceLinkRepository: {
          findMany: jest.fn().mockResolvedValue([getTestDeviceLink()]),
          destroyMany: jest.fn(),
        },
      },
      token: {
        bearerToken: {
          subject: "subject",
        },
      },
    };

    destroyDeviceLinkCallback.mockImplementation(() => "destroyDeviceLinkCallback");
  });

  test("should resolve", async () => {
    await expect(rtbfController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.deviceLinkRepository.destroyMany).toHaveBeenCalled();
  });
});
