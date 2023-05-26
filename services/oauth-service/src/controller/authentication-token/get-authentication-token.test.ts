import MockDate from "mockdate";
import {
  createTestAuthenticationTokenSession,
  createTestClient,
  createTestTenant,
} from "../../fixtures/entity";
import { getAuthenticationTokenSessionController } from "./get-authentication-token";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getClaimsSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        authenticationTokenSession: createTestAuthenticationTokenSession({
          id: "6016cfd6-a8e2-4949-9eff-4fe5a7cb7c3b",
          audiences: ["5d109728-b5db-42cc-b93c-44c78994678d"],
          clientId: "d778c5b4-cd54-4bdd-b8b9-cda8fb70ab14",
          token: "token",
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
    await expect(getAuthenticationTokenSessionController(ctx)).resolves.toStrictEqual({
      body: {
        authenticationTokenSession: {
          audiences: ["5d109728-b5db-42cc-b93c-44c78994678d"],
          expires: "2021-01-02T08:00:00.000Z",
          id: "6016cfd6-a8e2-4949-9eff-4fe5a7cb7c3b",
          metadata: {
            ip: "192.168.0.1",
            platform: "iOS",
          },
          scopes: ["openid", "profile"],
          token: "token",
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
