import MockDate from "mockdate";
import { getValidDeviceLinks } from "./get-valid-device-links";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getValidDeviceLinks", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      axios: {
        deviceClient: {
          get: jest.fn().mockResolvedValue({
            data: {
              deviceLinks: ["1", "2", "3", "4"],
            },
          }),
        },
        oauthClient: {},
      },
    };
  });

  test("should resolve", async () => {
    await expect(getValidDeviceLinks(ctx, "1")).resolves.toStrictEqual(["1", "2", "3", "4"]);
  });

  test("should resolve empty array on missing identity", async () => {
    await expect(getValidDeviceLinks(ctx, undefined)).resolves.toStrictEqual([]);
  });

  test("should resolve empty array on error", async () => {
    ctx.axios.deviceClient.get.mockRejectedValue(new Error("message"));

    await expect(getValidDeviceLinks(ctx, "1")).resolves.toStrictEqual([]);
  });
});
