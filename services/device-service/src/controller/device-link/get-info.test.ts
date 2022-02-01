import MockDate from "mockdate";
import { getDeviceLinkInfoController } from "./get-info";
import { getTestDeviceLink } from "../../test/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getDeviceLinkController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      entity: {
        deviceLink: await getTestDeviceLink({
          id: "ded67066-ba3a-4898-b537-de12d4b7f86d",
          identityId: "b799b044-16db-495a-b7e1-2cf3175d4b54",
          installationId: "12be09f5-fcd4-438f-9b5d-dc1fb11e5e75",
          uniqueId: "27a10522a6994bbca0e1fc666804b350",
        }),
      },
    };
  });

  test("should resolve with deviceLink information", async () => {
    await expect(getDeviceLinkInfoController(ctx)).resolves.toStrictEqual({
      body: {
        id: "ded67066-ba3a-4898-b537-de12d4b7f86d",
        active: true,
        deviceMetadata: {
          brand: "Apple",
          buildId: "12A269",
          buildNumber: "89",
          macAddress: "0B:ED:A0:D5:5A:2D",
          model: "iPhone7,2",
          systemName: "iOS",
        },
        identityId: "b799b044-16db-495a-b7e1-2cf3175d4b54",
        installationId: "12be09f5-fcd4-438f-9b5d-dc1fb11e5e75",
        name: "Test DeviceLink Name",
        trusted: true,
        uniqueId: "27a10522a6994bbca0e1fc666804b350",
      },
    });
  });
});
