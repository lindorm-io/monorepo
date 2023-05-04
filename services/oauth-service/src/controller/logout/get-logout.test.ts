import MockDate from "mockdate";
import { getLogoutController } from "./get-logout";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import {
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
  createTestLogoutSession,
  createTestTenant,
} from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getLogoutController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        client: createTestClient({
          id: "d778c5b4-cd54-4bdd-b8b9-cda8fb70ab14",
        }),
        logoutSession: createTestLogoutSession({
          id: "63624e5c-e23d-49e9-892a-0274a6f6781f",
          clientId: "d778c5b4-cd54-4bdd-b8b9-cda8fb70ab14",
          identityId: "41da1da6-cf20-4744-893d-2b1615b222ad",
          requestedLogout: {
            clientSessionId: "bb37db7e-264b-4206-96f6-4b340d0113d5",
            browserSessionId: "94500db2-657a-46f6-b8b6-fe8b6dd7603d",
          },
        }),
        tenant: createTestTenant({
          id: "f23028ac-6d61-4bc7-b0cf-8ef00cf92303",
        }),
      },
      mongo: {
        browserSessionRepository: createMockMongoRepository(createTestBrowserSession),
        clientSessionRepository: createMockMongoRepository(createTestClientSession),
      },
    };
  });

  test("should resolve", async () => {
    ctx.mongo.clientSessionRepository.findMany.mockResolvedValue([
      createTestClientSession({
        id: "bb37db7e-264b-4206-96f6-4b340d0113d5",
      }),
      createTestClientSession(),
      createTestClientSession(),
    ]);

    await expect(getLogoutController(ctx)).resolves.toStrictEqual({
      body: {
        logout: {
          status: "pending",

          browserSession: {
            id: "94500db2-657a-46f6-b8b6-fe8b6dd7603d",
            connectedSessions: 2,
          },
          clientSession: {
            id: "bb37db7e-264b-4206-96f6-4b340d0113d5",
          },
        },

        logoutSession: {
          id: "63624e5c-e23d-49e9-892a-0274a6f6781f",
          expires: "2021-01-02T08:00:00.000Z",
          idTokenHint: "jwt.jwt.jwt",
          identityId: "41da1da6-cf20-4744-893d-2b1615b222ad",
          logoutHint: "logout-hint",
          originalUri: "https://localhost/oauth2/sessions/logout?query=query",
          uiLocales: ["en-GB"],
        },

        client: {
          id: "d778c5b4-cd54-4bdd-b8b9-cda8fb70ab14",
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
