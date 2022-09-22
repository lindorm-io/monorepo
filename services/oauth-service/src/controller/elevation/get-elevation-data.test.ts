import MockDate from "mockdate";
import { createTestElevationSession } from "../../fixtures/entity";
import { getElevationDataController } from "./get-elevation-data";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getElevationDataController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        elevationSession: createTestElevationSession({
          id: "0d32448e-d300-4ec8-8bd5-c60457be0391",
          identityId: "9a55d16f-42ee-4b15-b228-7d02e8df31b7",
          nonce: "QxEQ4H21R-gslTwr",
        }),
      },
    };
  });

  test("should resolve", async () => {
    await expect(getElevationDataController(ctx)).resolves.toStrictEqual({
      body: {
        elevationStatus: "pending",
        elevationSession: {
          id: "0d32448e-d300-4ec8-8bd5-c60457be0391",
          authenticationHint: ["test@lindorm.io"],
          country: "se",
          expiresAt: "2021-01-02T08:00:00.000Z",
          expiresIn: 86400,
          identityId: "9a55d16f-42ee-4b15-b228-7d02e8df31b7",
          nonce: "QxEQ4H21R-gslTwr",
          uiLocales: ["sv-SE", "en-GB"],
        },
        requested: {
          authenticationMethods: ["email"],
          levelHint: 1,
          levelOfAssurance: 2,
          methodHint: ["email", "phone"],
          missingAccessLevel: 1,
        },
      },
    });
  });
});
