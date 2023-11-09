import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
import MockDate from "mockdate";
import { createTestClaimsSession, createTestClient, createTestTenant } from "../../fixtures/entity";
import { getClaimsSessionController } from "./get-claims-request";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getClaimsSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        claimsSession: createTestClaimsSession({
          id: "6016cfd6-a8e2-4949-9eff-4fe5a7cb7c3b",
          audiences: ["5d109728-b5db-42cc-b93c-44c78994678d"],
          clientId: "d778c5b4-cd54-4bdd-b8b9-cda8fb70ab14",
          identityId: "41da1da6-cf20-4744-893d-2b1615b222ad",
        }),
        client: createTestClient({
          id: "d778c5b4-cd54-4bdd-b8b9-cda8fb70ab14",
        }),
        tenant: createTestTenant({
          id: "6422ce07-0db2-4a5d-b8a0-dd6ea10c1d94",
        }),
      },
    };
  });

  test("should resolve", async () => {
    await expect(getClaimsSessionController(ctx)).resolves.toStrictEqual({
      body: {
        claimsSession: {
          id: "6016cfd6-a8e2-4949-9eff-4fe5a7cb7c3b",
          adjustedAccessLevel: 2,
          audiences: ["5d109728-b5db-42cc-b93c-44c78994678d"],
          expires: "2021-01-02T08:00:00.000Z",
          factors: [AuthenticationFactor.TWO_FACTOR],
          identityId: "41da1da6-cf20-4744-893d-2b1615b222ad",
          latestAuthentication: "2021-01-01T07:59:00.000Z",
          levelOfAssurance: 2,
          metadata: {
            ip: "192.168.0.1",
            platform: "iOS",
          },
          methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
          scopes: ["openid", "profile"],
          strategies: [AuthenticationStrategy.EMAIL_CODE, AuthenticationStrategy.PHONE_OTP],
        },

        client: {
          id: "d778c5b4-cd54-4bdd-b8b9-cda8fb70ab14",
          name: "ClientName",
          logoUri: "https://logo.uri/logo",
          singleSignOn: true,
          type: "confidential",
        },

        tenant: {
          id: "6422ce07-0db2-4a5d-b8a0-dd6ea10c1d94",
          name: "TenantName",
        },
      },
    });
  });
});
