import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import {
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
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
      mongo: {
        browserSessionRepository: createMockMongoRepository(() =>
          createTestBrowserSession({
            id: "ea1be311-26b3-4a75-8911-2ca1451bfee0",
            identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
          }),
        ),
        clientSessionRepository: createMockMongoRepository(() =>
          createTestClientSession({
            id: "f37c5ac7-c8da-42e3-ac3b-35e9dc523d9b",
            audiences: ["d47d233e-9d77-4538-be99-379207440889"],
            identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
          }),
        ),
      },
    };
  });

  test("should resolve", async () => {
    await expect(getElevationController(ctx)).resolves.toStrictEqual({
      body: {
        elevation: {
          isRequired: true,
          status: "pending",

          factors: [AuthenticationFactor.TWO_FACTOR],
          levelOfAssurance: 4,
          methods: [AuthenticationMethod.EMAIL],
          minimumLevelOfAssurance: 2,
          strategies: [AuthenticationStrategy.PHONE_OTP],
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

        browserSession: {
          id: "ea1be311-26b3-4a75-8911-2ca1451bfee0",
          adjustedAccessLevel: 2,
          factors: [AuthenticationFactor.TWO_FACTOR],
          identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
          latestAuthentication: "2021-01-01T07:59:00.000Z",
          levelOfAssurance: 2,
          methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
          remember: true,
          singleSignOn: true,
          strategies: [AuthenticationStrategy.EMAIL_CODE, AuthenticationStrategy.PHONE_OTP],
        },

        clientSession: {
          id: "f37c5ac7-c8da-42e3-ac3b-35e9dc523d9b",
          adjustedAccessLevel: 2,
          audiences: ["d47d233e-9d77-4538-be99-379207440889"],
          factors: [AuthenticationFactor.TWO_FACTOR],
          identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
          latestAuthentication: "2021-01-01T07:59:00.000Z",
          levelOfAssurance: 2,
          methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
          scopes: ["openid", "profile"],
          strategies: [AuthenticationStrategy.EMAIL_CODE, AuthenticationStrategy.PHONE_OTP],
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
