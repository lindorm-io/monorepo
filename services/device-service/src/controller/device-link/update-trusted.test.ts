import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestDeviceLink } from "../../fixtures/entity";
import { updateDeviceLinkTrustedController } from "./update-trusted";

jest.mock("../../util");

describe("updateDeviceLinkTrustedController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      entity: {
        deviceLink: createTestDeviceLink(),
      },
      mongo: {
        deviceLinkRepository: createMockMongoRepository(createTestDeviceLink),
      },
      token: { challengeConfirmationToken: { token: "jwt.jwt.jwt" } },
    };
  });

  test("should resolve and update deviceLink trusted", async () => {
    await expect(updateDeviceLinkTrustedController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.deviceLinkRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        trusted: true,
      }),
    );
  });
});
