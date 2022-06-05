import MockDate from "mockdate";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestDeviceLink } from "../../fixtures/entity";
import { updateDeviceLinkBiometryController } from "./update-biometry";
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

describe("updateDeviceLinkBiometryController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      data: {
        biometry: "new-biometry",
      },
      entity: {
        deviceLink: createTestDeviceLink(),
      },
      metadata: {
        agent: { os: null },
        device: { name: null },
      },
      repository: {
        deviceLinkRepository: createMockRepository(createTestDeviceLink),
      },
      token: { challengeConfirmationToken: { token: "jwt.jwt.jwt" } },
    };

    vaultGetSalt.mockResolvedValue({
      aes: "aes",
      sha: "sha",
    });
  });

  test("should resolve and update deviceLink biometry", async () => {
    await expect(updateDeviceLinkBiometryController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.deviceLinkRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        biometry: "new-biometry-signature",
      }),
    );
  });

  test("should resolve and update with deviceLink name", async () => {
    ctx.metadata.device.name = "name";

    await expect(updateDeviceLinkBiometryController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.deviceLinkRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "name",
      }),
    );
  });
});
