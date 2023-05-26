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
        client: createTestClient({
          id: "729ede7e-e3ac-4c26-a5e2-c6f0be03c3c9",
        }),
        elevationSession: createTestElevationSession({
          id: "b3fde7ae-8d2a-4ac0-bf7c-95aabc96a267",
          identityId: "9a55d16f-42ee-4b15-b228-7d02e8df31b7",
          nonce: "QxEQ4H21R-gslTwr",
        }),
        tenant: createTestTenant({
          id: "f23028ac-6d61-4bc7-b0cf-8ef00cf92303",
        }),
      },
    };
  });

  test("should resolve", async () => {
    await expect(getElevationController(ctx)).resolves.toStrictEqual({
      body: {
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
          id: "b3fde7ae-8d2a-4ac0-bf7c-95aabc96a267",
          authenticationHint: ["test@lindorm.io"],
          country: "se",
          displayMode: "page",
          expires: "2021-01-02T08:00:00.000Z",
          idTokenHint: "id.jwt.jwt",
          identityId: "9a55d16f-42ee-4b15-b228-7d02e8df31b7",
          nonce: "QxEQ4H21R-gslTwr",
          uiLocales: ["sv-SE", "en-GB"],
        },

        client: {
          id: "729ede7e-e3ac-4c26-a5e2-c6f0be03c3c9",
          name: "ClientName",
          logoUri: "https://logo.uri/logo",
          singleSignOn: true,
          type: "confidential",
        },

        tenant: {
          id: "f23028ac-6d61-4bc7-b0cf-8ef00cf92303",
          name: "TenantName",
        },
      },
    });
  });
});
