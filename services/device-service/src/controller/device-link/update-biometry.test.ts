import MockDate from "mockdate";
import { updateDeviceLinkBiometryController } from "./update-biometry";
import { getTestDeviceLink } from "../../test/entity";

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

jest.mock("../../util");

describe("updateDeviceLinkBiometryController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      data: {
        biometry: "new-biometry",
      },
      entity: {
        deviceLink: await getTestDeviceLink(),
      },
      metadata: {
        agent: { os: null },
        device: { name: null },
      },
      repository: {
        deviceLinkRepository: {
          update: jest.fn(),
        },
      },
      token: { challengeConfirmationToken: { token: "jwt.jwt.jwt" } },
    };
  });

  test("should resolve and update deviceLink biometry", async () => {
    await expect(updateDeviceLinkBiometryController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(ctx.repository.deviceLinkRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        biometry: "new-biometry-signature",
      }),
    );
  });

  test("should resolve and update with deviceLink name", async () => {
    ctx.metadata.device.name = "name";

    await expect(updateDeviceLinkBiometryController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(ctx.repository.deviceLinkRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "name",
      }),
    );
  });
});
