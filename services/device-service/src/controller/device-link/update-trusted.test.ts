import { updateDeviceLinkTrustedController } from "./update-trusted";
import { getTestDeviceLink } from "../../test/entity";

jest.mock("../../util");

describe("updateDeviceLinkTrustedController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      entity: {
        deviceLink: await getTestDeviceLink(),
      },
      repository: {
        deviceLinkRepository: {
          update: jest.fn(),
        },
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
