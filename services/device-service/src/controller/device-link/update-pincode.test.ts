import MockDate from "mockdate";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestDeviceLink } from "../../fixtures/entity";
import { updateDeviceLinkPincodeController } from "./update-pincode";
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
        deviceLink: createTestDeviceLink({
          id: "5bc0f501-e078-4778-85de-d969d6e71ff0",
          identityId: "d890e6bb-531e-4b57-a80e-1f09e7b0832b",
        }),
      },
      metadata: {
        agent: { os: null },
        device: {
          linkId: "5bc0f501-e078-4778-85de-d969d6e71ff0",
          name: null,
        },
      },
      repository: {
        deviceLinkRepository: createMockRepository(createTestDeviceLink),
      },
      token: {
        bearerToken: {
          subject: "d890e6bb-531e-4b57-a80e-1f09e7b0832b",
        },
        challengeConfirmationToken: {
          claims: {
            deviceLinkId: "5bc0f501-e078-4778-85de-d969d6e71ff0",
          },
          token: "jwt.jwt.jwt",
        },
      },
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
