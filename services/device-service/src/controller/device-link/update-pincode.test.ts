import MockDate from "mockdate";
import { updateDeviceLinkPincodeController } from "./update-pincode";
import { getTestDeviceLink } from "../../test/entity";
import { vaultGetSalt as _vaultGetSalt } from "../../handler";

MockDate.set("2021-01-01T08:00:00.000Z");

const cryptoAssert = jest.fn();
jest.mock("@lindorm-io/crypto", () => ({
  CryptoLayered: class CryptoLayered {
    async assert(...args: any) {
      return cryptoAssert(...args);
    }
    async encrypt(arg: any) {
      return `${arg}-signature`;
    }
  },
}));
jest.mock("../../handler");
jest.mock("../../util");

const vaultGetSalt = _vaultGetSalt as jest.Mock;

describe("updateDeviceLinkPincodeController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      data: {
        pincode: "new-pincode",
      },
      entity: {
        deviceLink: await getTestDeviceLink(),
      },
      metadata: {
        device: { name: null },
      },
      repository: {
        deviceLinkRepository: {
          update: jest.fn(),
        },
      },
      token: { challengeConfirmationToken: { token: "jwt.jwt.jwt" } },
    };

    vaultGetSalt.mockResolvedValue({
      aes: "aes",
      sha: "sha",
    });
  });

  test("should resolve and update deviceLink pincode", async () => {
    await expect(updateDeviceLinkPincodeController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.deviceLinkRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        pincode: "new-pincode-signature",
      }),
    );
  });

  test("should resolve and update with deviceLink name", async () => {
    ctx.metadata.device.name = "name";

    await expect(updateDeviceLinkPincodeController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.deviceLinkRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "name",
      }),
    );
  });
});
