import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestDeviceLink } from "../../fixtures/entity";
import { destroyDeviceLinkCallback as _destroyDeviceLinkCallback } from "../../handler";
import { rtbfController } from "./rtbf";

jest.mock("../../handler");

const destroyDeviceLinkCallback = _destroyDeviceLinkCallback as jest.Mock;

describe("rtbfController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      mongo: {
        deviceLinkRepository: createMockMongoRepository(createTestDeviceLink),
      },
      token: {
        bearerToken: {
          subject: "subject",
        },
      },
    };

    destroyDeviceLinkCallback.mockReturnValue("destroyDeviceLinkCallback");
  });

  test("should resolve", async () => {
    await expect(rtbfController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.deviceLinkRepository.destroyMany).toHaveBeenCalled();
  });
});
