import MockDate from "mockdate";
import { getLogoutController } from "./get-logout";
import {
  createTestAccessSession,
  createTestBrowserSession,
  createTestClient,
  createTestLogoutSession,
  createTestRefreshSession,
  createTestTenant,
} from "../../fixtures/entity";
import { createMockRepository } from "@lindorm-io/mongo";

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
          clientId: "d778c5b4-cd54-4bdd-b8b9-cda8fb70ab14",
          identityId: "41da1da6-cf20-4744-893d-2b1615b222ad",
          requestedLogout: {
            accessSessionId: "bb37db7e-264b-4206-96f6-4b340d0113d5",
            browserSessionId: "94500db2-657a-46f6-b8b6-fe8b6dd7603d",
            refreshSessionId: null,
          },
        }),
        tenant: createTestTenant(),
      },
      repository: {
        accessSessionRepository: createMockRepository(createTestAccessSession),
        browserSessionRepository: createMockRepository(createTestBrowserSession),
        refreshSessionRepository: createMockRepository(createTestRefreshSession),
      },
    };
  });

  test("should resolve", async () => {
    ctx.repository.accessSessionRepository.findMany.mockResolvedValue([
      createTestAccessSession({
        id: "bb37db7e-264b-4206-96f6-4b340d0113d5",
      }),
      createTestAccessSession(),
      createTestAccessSession(),
    ]);
    await expect(getLogoutController(ctx)).resolves.toStrictEqual({
      body: {
        logout: {
          status: "pending",

          accessSession: {
            id: "bb37db7e-264b-4206-96f6-4b340d0113d5",
          },
          browserSession: {
            id: "94500db2-657a-46f6-b8b6-fe8b6dd7603d",
            connectedSessions: 2,
          },
          refreshSession: {
            id: null,
          },
        },

        client: {
          tenant: "TenantName",
          logoUri: "https://logo.uri/logo",
          name: "ClientName",
          type: "confidential",
        },
        logoutSession: {
          expires: "2021-01-02T08:00:00.000Z",
          idTokenHint: "jwt.jwt.jwt",
          identityId: "41da1da6-cf20-4744-893d-2b1615b222ad",
          logoutHint: "logout-hint",
          originalUri: "https://localhost/oauth2/sessions/logout?query=query",
          uiLocales: ["en-GB"],
        },
      },
    });
  });
});
