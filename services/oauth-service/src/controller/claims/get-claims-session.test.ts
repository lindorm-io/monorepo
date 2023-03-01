import MockDate from "mockdate";
import { getClaimsSessionController } from "./get-claims-session";
import { createTestClaimsSession, createTestClient, createTestTenant } from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getClaimsSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        claimsSession: createTestClaimsSession({
          audiences: ["5d109728-b5db-42cc-b93c-44c78994678d"],
          clientId: "d778c5b4-cd54-4bdd-b8b9-cda8fb70ab14",
          identityId: "41da1da6-cf20-4744-893d-2b1615b222ad",
        }),
        client: createTestClient({
          id: "d778c5b4-cd54-4bdd-b8b9-cda8fb70ab14",
        }),
        tenant: createTestTenant(),
      },
    };
  });

  test("should resolve", async () => {
    await expect(getClaimsSessionController(ctx)).resolves.toStrictEqual({
      body: {
        adjustedAccessLevel: 2,
        audiences: ["5d109728-b5db-42cc-b93c-44c78994678d"],
        client: {
          logoUri: "https://logo.uri/logo",
          name: "ClientName",
          tenant: "TenantName",
          type: "confidential",
        },
        expiresAt: "2021-01-02T08:00:00.000Z",
        expiresIn: 86400,
        identityId: "41da1da6-cf20-4744-893d-2b1615b222ad",
        latestAuthentication: "2021-01-01T07:59:00.000Z",
        levelOfAssurance: 2,
        metadata: {
          ip: "192.168.0.1",
          platform: "iOS",
        },
        methods: ["email", "phone"],
        scopes: ["openid", "profile"],
      },
    });
  });
});
