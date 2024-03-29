import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { createTestDeviceLink } from "../../fixtures/entity";
import {
  getDeviceHeaders as _getDeviceHeaders,
  vaultGetSalt as _vaultGetSalt,
} from "../../handler";
import { updateDeviceLinkPincodeController } from "./update-pincode";

MockDate.set("2021-01-01T08:00:00.000Z");

const cryptoAssert = jest.fn();
jest.mock("@lindorm-io/crypto", () => ({
  CryptoLayered: class CryptoLayered {
    async assert(...args: any) {
      return cryptoAssert(...args);
    }
    async sign(arg: any) {
      return `${arg}-signature`;
    }
  },
}));
jest.mock("../../handler");
jest.mock("../../util");

const getDeviceHeaders = _getDeviceHeaders as jest.Mock;
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
          id: "2b16e7e6-8e88-4b5f-b667-e4b52b9ac853",
          identityId: "d890e6bb-531e-4b57-a80e-1f09e7b0832b",
        }),
      },
      mongo: {
        deviceLinkRepository: createMockMongoRepository(createTestDeviceLink),
      },
      token: {
        bearerToken: {
          subject: "d890e6bb-531e-4b57-a80e-1f09e7b0832b",
        },
        challengeConfirmationToken: {
          claims: {
            deviceLinkId: "2b16e7e6-8e88-4b5f-b667-e4b52b9ac853",
          },
          token: "jwt.jwt.jwt",
        },
      },
    };

    getDeviceHeaders.mockReturnValue({
      installationId: "b75393fd-2cdf-449a-810f-b14c0d11e871",
      linkId: "2b16e7e6-8e88-4b5f-b667-e4b52b9ac853",
      name: "name",
      systemVersion: "1.0.0",
      uniqueId: "474aacfa09474d4caaf903977b896213",
    });
    vaultGetSalt.mockResolvedValue({
      aes: "aes",
      sha: "sha",
    });
  });

  test("should resolve and update deviceLink pincode", async () => {
    await expect(updateDeviceLinkPincodeController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.deviceLinkRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        pincode: "new-pincode-signature",
      }),
    );
  });

  test("should resolve and update with deviceLink name", async () => {
    await expect(updateDeviceLinkPincodeController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.deviceLinkRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "name",
      }),
    );
  });
});
