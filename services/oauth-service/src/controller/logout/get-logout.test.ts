import MockDate from "mockdate";
import { getLogoutController } from "./get-logout";
import { createTestClient, createTestLogoutSession } from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getLogoutInfoController", () => {
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
            accessSessions: ["67ee4fde-8704-4863-ab71-9f7d1864082b"],
            browserSessionId: "94500db2-657a-46f6-b8b6-fe8b6dd7603d",
            refreshSessionId: null,
            refreshSessions: [],
          },
        }),
      },
    };
  });

  test("should resolve", async () => {
    await expect(getLogoutController(ctx)).resolves.toStrictEqual({
      body: {
        logout: {
          accessSessionId: "bb37db7e-264b-4206-96f6-4b340d0113d5",
          accessSessions: ["67ee4fde-8704-4863-ab71-9f7d1864082b"],
          browserSessionId: "94500db2-657a-46f6-b8b6-fe8b6dd7603d",
          refreshSessionId: null,
          refreshSessions: [],
        },

        client: {
          description: "Client description",
          logoUri: "https://logo.uri/logo",
          name: "ClientName",
          type: "confidential",
        },
        logoutSession: {
          clientId: "d778c5b4-cd54-4bdd-b8b9-cda8fb70ab14",
          expiresAt: "2021-01-02T08:00:00.000Z",
          expiresIn: 86400,
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
