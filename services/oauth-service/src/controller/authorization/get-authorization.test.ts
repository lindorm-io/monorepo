import MockDate from "mockdate";
import { AuthenticationMethod, OpenIdScope, SessionStatus } from "@lindorm-io/common-types";
import { createMockRepository } from "@lindorm-io/mongo";
import { getAuthorizationController } from "./get-authorization";
import {
  getAdjustedAccessLevel as _getAdjustedAccessLevel,
  isConsentRequired as _isConsentRequired,
  isLoginRequired as _isLoginRequired,
  isSelectAccountRequired as _isSelectAccountRequired,
} from "../../util";
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
  createTestTenant,
} from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const getAdjustedAccessLevel = _getAdjustedAccessLevel as jest.Mock;
const isConsentRequired = _isConsentRequired as jest.Mock;
const isLoginRequired = _isLoginRequired as jest.Mock;
const isSelectAccountRequired = _isSelectAccountRequired as jest.Mock;

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
          OpenIdScope.ADDRESS,
          OpenIdScope.EMAIL,
          OpenIdScope.OFFLINE_ACCESS,
          OpenIdScope.OPENID,
          OpenIdScope.PHONE,
          OpenIdScope.PROFILE,
        ],
      },
      requestedLogin: {
        identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
        minimumLevel: 2,
        recommendedLevel: 2,
        recommendedMethods: [AuthenticationMethod.EMAIL],
        requiredLevel: 3,
        requiredMethods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
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
        consent: SessionStatus.PENDING,
        login: SessionStatus.PENDING,
        selectAccount: SessionStatus.PENDING,
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
        tenant: createTestTenant(),
      },
      repository: {
        accessSessionRepository: createMockRepository(() => accessSession),
        browserSessionRepository: createMockRepository(() => browserSession),
        refreshSessionRepository: createMockRepository(() => refreshSession),
      },
    };

    getAdjustedAccessLevel.mockImplementation(() => 0);
    isConsentRequired.mockImplementation(() => true);
    isLoginRequired.mockImplementation(() => true);
    isSelectAccountRequired.mockImplementation(() => true);
  });

  test("should resolve", async () => {
    await expect(getAuthorizationController(ctx)).resolves.toStrictEqual({
      body: {
        consent: {
          isRequired: true,
          status: "pending",

          audiences: ["fecdd5e7-6e6c-4bc7-8473-e87f8a1d13db"],
          optionalScopes: ["address", "email", "phone", "profile"],
          requiredScopes: ["offline_access", "openid"],
          scopeDescriptions: [
            { name: "openid", description: "Give the client access to your OpenID claims." },
            { name: "profile", description: "Give the client access to your profile information." },
          ],
        },
        login: {
          isRequired: true,
          status: "pending",

          identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
          minimumLevel: 2,
          recommendedLevel: 2,
          recommendedMethods: ["email"],
          requiredLevel: 3,
          requiredMethods: ["email", "phone"],
        },
        selectAccount: {
          isRequired: true,
          status: "pending",

          sessions: [
            {
              identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
              selectId: "ea1be311-26b3-4a75-8911-2ca1451bfee0",
            },
          ],
        },

        accessSession: {
          adjustedAccessLevel: 0,
          audiences: ["42e2190d-7c45-41f4-b169-e17bc14a17cc"],
          identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
          latestAuthentication: "2021-01-01T07:59:00.000Z",
          levelOfAssurance: 2,
          methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
          scopes: ["openid", "profile"],
        },

        authorizationSession: {
          authToken: "auth.jwt.jwt",
          country: "se",
          displayMode: "popup",
          expires: "2021-01-02T08:00:00.000Z",
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
          adjustedAccessLevel: 0,
          identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
          latestAuthentication: "2021-01-01T07:59:00.000Z",
          levelOfAssurance: 2,
          methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
          remember: true,
          sso: true,
        },

        client: {
          name: "ClientName",
          logoUri: "https://logo.uri/logo",
          tenant: "TenantName",
          type: "confidential",
        },

        refreshSession: {
          adjustedAccessLevel: 0,
          audiences: ["d47d233e-9d77-4538-be99-379207440889"],
          identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
          latestAuthentication: "2021-01-01T07:59:00.000Z",
          levelOfAssurance: 2,
          methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
          scopes: ["openid", "profile"],
        },
      },
    });
  });
});
