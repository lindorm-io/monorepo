import MockDate from "mockdate";
import {
  createTestClient,
  createTestElevationSession,
  createTestTenant,
} from "../../fixtures/entity";
import { getElevationController } from "./get-elevation";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getElevationDataController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        client: createTestClient(),
        elevationSession: createTestElevationSession({
          identityId: "9a55d16f-42ee-4b15-b228-7d02e8df31b7",
          nonce: "QxEQ4H21R-gslTwr",
        }),
        tenant: createTestTenant(),
      },
    };
  });

  test("should resolve", async () => {
    await expect(getElevationController(ctx)).resolves.toStrictEqual({
      body: {
        client: {
          name: "ClientName",
          tenant: "TenantName",
          logoUri: "https://logo.uri/logo",
          type: "confidential",
        },
        elevation: {
          isRequired: true,
          status: "pending",

          minimumLevel: 1,
          recommendedLevel: 1,
          recommendedMethods: ["email", "phone"],
          requiredLevel: 2,
          requiredMethods: ["email"],
        },
        elevationSession: {
          authenticationHint: ["test@lindorm.io"],
          country: "se",
          displayMode: "page",
          expiresAt: "2021-01-02T08:00:00.000Z",
          expiresIn: 86400,
          idTokenHint: "id.jwt.jwt",
          identityId: "9a55d16f-42ee-4b15-b228-7d02e8df31b7",
          nonce: "QxEQ4H21R-gslTwr",
          uiLocales: ["sv-SE", "en-GB"],
        },
      },
    });
  });
});
