import { createMockRepository } from "@lindorm-io/mongo";
import { destroyDeviceLinkCallback as _destroyDeviceLinkCallback } from "../../handler";
import { getTestDeviceLink } from "../../test/entity";
import { rtbfController } from "./rtbf";

jest.mock("../../handler");

const destroyDeviceLinkCallback = _destroyDeviceLinkCallback as jest.Mock;

describe("rtbfController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      repository: {
        deviceLinkRepository: createMockRepository((options) => getTestDeviceLink(options)),
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
