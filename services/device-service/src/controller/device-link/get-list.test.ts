import MockDate from "mockdate";
import { getDeviceLinkListController } from "./get-list";
import { createTestDeviceLink } from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getDeviceLinkListController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      mongo: {
        deviceLinkRepository: {
          findMany: async () => [
            await createTestDeviceLink({ id: "ded67066-ba3a-4898-b537-de12d4b7f86d" }),
            await createTestDeviceLink({ id: "616b4b54-608f-4e88-805e-a43dd2b2ecc4" }),
          ],
        },
      },
      token: {
        bearerToken: {
          subject: "identityId",
        },
      },
    };
  });

  test("should resolve with list of deviceLinks", async () => {
    await expect(getDeviceLinkListController(ctx)).resolves.toStrictEqual({
      body: {
        deviceLinks: [
          {
            id: "ded67066-ba3a-4898-b537-de12d4b7f86d",
            active: true,
            metadata: {
              brand: "Apple",
              buildId: "12A269",
              buildNumber: "89",
              macAddress: "0B:ED:A0:D5:5A:2D",
              model: "iPhone7,2",
              systemName: "iOS",
            },
            name: "Test DeviceLink Name",
            trusted: true,
          },
          {
            id: "616b4b54-608f-4e88-805e-a43dd2b2ecc4",
            active: true,
            metadata: {
              brand: "Apple",
              buildId: "12A269",
              buildNumber: "89",
              macAddress: "0B:ED:A0:D5:5A:2D",
              model: "iPhone7,2",
              systemName: "iOS",
            },
            name: "Test DeviceLink Name",
            trusted: true,
          },
        ],
      },
    });
  });
});
