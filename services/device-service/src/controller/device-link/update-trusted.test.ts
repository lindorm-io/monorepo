import { createMockRepository } from "@lindorm-io/mongo";
import { getTestDeviceLink } from "../../test/entity";
import { updateDeviceLinkTrustedController } from "./update-trusted";

jest.mock("../../util");

describe("updateDeviceLinkTrustedController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      entity: {
        deviceLink: await getTestDeviceLink(),
      },
      repository: {
        deviceLinkRepository: createMockRepository(),
      },
      token: { challengeConfirmationToken: { token: "jwt.jwt.jwt" } },
    };
  });

  test("should resolve and update deviceLink trusted", async () => {
    await expect(updateDeviceLinkTrustedController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.deviceLinkRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        trusted: true,
      }),
    );
  });
});
