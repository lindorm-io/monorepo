import MockDate from "mockdate";
import { AuthenticationMethods, LindormScopes } from "@lindorm-io/common-types";
import { createMockRepository } from "@lindorm-io/mongo";
import { getAuthorizationController } from "./get-authorization";
import {
  AccessSession,
  AuthorizationSession,
  BrowserSession,
  Client,
  RefreshSession,
} from "../../entity";
import {
  createTestAccessSession,
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestRefreshSession,
} from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getAuthorizationController", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;
  let client: Client;
  let accessSession: AccessSession;
  let browserSession: BrowserSession;
  let refreshSession: RefreshSession;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession({
      requestedConsent: {
        audiences: ["fecdd5e7-6e6c-4bc7-8473-e87f8a1d13db"],
        scopes: [
          LindormScopes.ADDRESS,
          LindormScopes.EMAIL,
          LindormScopes.OFFLINE_ACCESS,
          LindormScopes.OPENID,
          LindormScopes.PHONE,
          LindormScopes.PROFILE,
        ],
      },
      requestedLogin: {
        identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
        minimumLevel: 2,
        recommendedLevel: 2,
        recommendedMethods: [AuthenticationMethods.EMAIL],
        requiredLevel: 3,
        requiredMethods: [AuthenticationMethods.EMAIL, AuthenticationMethods.PHONE],
      },
      requestedSelectAccount: {
        browserSessions: [
          {
            browserSessionId: "ea1be311-26b3-4a75-8911-2ca1451bfee0",
            identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
          },
        ],
      },
      status: {
        consent: "pending",
        login: "pending",
        selectAccount: "pending",
      },
      clientId: "db5c195a-1c0b-41b2-b047-94c13a7dd30d",
      accessSessionId: "713c06a5-9acc-47ae-a26f-2863b01fd089",
      browserSessionId: "ea1be311-26b3-4a75-8911-2ca1451bfee0",
      refreshSessionId: "f37c5ac7-c8da-42e3-ac3b-35e9dc523d9b",
      nonce: "TObaEXnNOfAeIgkE",
    });

    client = createTestClient({
      id: "db5c195a-1c0b-41b2-b047-94c13a7dd30d",
    });
    accessSession = createTestAccessSession({
      id: "713c06a5-9acc-47ae-a26f-2863b01fd089",
      audiences: ["42e2190d-7c45-41f4-b169-e17bc14a17cc"],
      identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
    });
    browserSession = createTestBrowserSession({
      id: "ea1be311-26b3-4a75-8911-2ca1451bfee0",
      identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
    });
    refreshSession = createTestRefreshSession({
      id: "f37c5ac7-c8da-42e3-ac3b-35e9dc523d9b",
      audiences: ["d47d233e-9d77-4538-be99-379207440889"],
      identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
    });

    ctx = {
      entity: {
        authorizationSession,
        client,
      },
      repository: {
        accessSessionRepository: createMockRepository(() => accessSession),
        browserSessionRepository: createMockRepository(() => browserSession),
        refreshSessionRepository: createMockRepository(() => refreshSession),
      },
    };
  });

  test("should resolve", async () => {
    await expect(getAuthorizationController(ctx)).resolves.toStrictEqual({
      body: {
        consent: {
          audiences: ["fecdd5e7-6e6c-4bc7-8473-e87f8a1d13db"],
          isRequired: true,
          scopes: ["address", "email", "offline_access", "openid", "phone", "profile"],
        },
        login: {
          identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
          isRequired: true,
          minimumLevel: 2,
          recommendedLevel: 2,
          recommendedMethods: ["email"],
          requiredLevel: 3,
          requiredMethods: ["email", "phone"],
        },
        selectAccount: {
          isRequired: true,
          sessions: [
            {
              identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
              selectId: "ea1be311-26b3-4a75-8911-2ca1451bfee0",
            },
          ],
        },

        accessSession: {
          adjustedAccessLevel: 2,
          audiences: ["42e2190d-7c45-41f4-b169-e17bc14a17cc"],
          identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
          latestAuthentication: expect.any(Date),
          levelOfAssurance: 2,
          methods: ["email", "phone"],
          scopes: ["openid", "profile"],
        },
        authorizationSession: {
          authToken: "auth.jwt.jwt",
          country: "se",
          displayMode: "popup",
          expiresAt: "2021-01-02T08:00:00.000Z",
          expiresIn: 86400,
          idTokenHint: "id.jwt.jwt",
          loginHint: ["test@lindorm.io"],
          maxAge: 999,
          nonce: "TObaEXnNOfAeIgkE",
          originalUri: "https://localhost/oauth2/authorize?query=query",
          promptModes: ["login", "consent", "select_account"],
          redirectUri: "https://test.client.lindorm.io/redirect",
          uiLocales: ["sv-SE", "en-GB"],
        },
        browserSession: {
          adjustedAccessLevel: 2,
          identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
          latestAuthentication: expect.any(Date),
          levelOfAssurance: 2,
          methods: ["email", "phone"],
          remember: true,
          sso: true,
        },
        client: {
          description: "Client description",
          logoUri: "https://logo.uri/logo",
          name: "ClientName",
          requiredScopes: ["offline_access", "openid"],
          scopeDescriptions: [
            {
              description: "Give the client access to your OpenID claims.",
              name: "openid",
            },
            {
              description: "Give the client access to your profile information.",
              name: "profile",
            },
          ],
          type: "confidential",
        },
        refreshSession: {
          adjustedAccessLevel: 2,
          audiences: ["d47d233e-9d77-4538-be99-379207440889"],
          identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
          latestAuthentication: expect.any(Date),
          levelOfAssurance: 2,
          methods: ["email", "phone"],
          scopes: ["openid", "profile"],
        },
      },
    });
  });
});
