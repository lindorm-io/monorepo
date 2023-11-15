import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestDeviceLink } from "../../fixtures/entity";
import { isRdcRequired } from "./is-rdc-required";
import { getDeviceHeaders as _getDeviceHeaders } from "../get-device-headers";

jest.mock("../get-device-headers");

const getDeviceHeaders = _getDeviceHeaders as jest.Mock;

describe("initialiseEnrolmentController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      metadata: {
        agent: {
          os: "os",
          platform: "platform",
        },
      },
      mongo: {
        deviceLinkRepository: createMockMongoRepository((opts) =>
          createTestDeviceLink({
            ...opts,
            installationId: "b75393fd-2cdf-449a-810f-b14c0d11e871",
            uniqueId: "474aacfa09474d4caaf903977b896213",
          }),
        ),
      },
    };

    getDeviceHeaders.mockReturnValue({
      installationId: "b75393fd-2cdf-449a-810f-b14c0d11e871",
      linkId: "2b16e7e6-8e88-4b5f-b667-e4b52b9ac853",
      name: "name",
      systemVersion: "1.0.0",
      uniqueId: "474aacfa09474d4caaf903977b896213",
    });
  });

  test("should resolve false", async () => {
    await expect(isRdcRequired(ctx, "identityId")).resolves.toBe(false);

    expect(ctx.mongo.deviceLinkRepository.findMany).toHaveBeenCalled();
  });

  test("should resolve true", async () => {
    ctx.mongo.deviceLinkRepository.findMany.mockResolvedValue([
      createTestDeviceLink({
        installationId: "b75393fd-2cdf-449a-810f-b14c0d11e871",
        uniqueId: "474aacfa09474d4caaf903977b896213",
      }),
      createTestDeviceLink({
        installationId: "c07aa448-a46b-409b-a469-7e024b6d130a",
        uniqueId: "94552f2377964e93aa3329d3765fa686",
      }),
    ]);

    await expect(isRdcRequired(ctx, "identityId")).resolves.toBe(true);
  });
});
