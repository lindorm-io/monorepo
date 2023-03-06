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
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
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

  beforeEach(() => {
    ctx = {
      entity: {
        authorizationSession: createTestAuthorizationSession({
          id: "bd959ef1-6782-46ea-baff-2eabad97d967",
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
          browserSessionId: "ea1be311-26b3-4a75-8911-2ca1451bfee0",
          clientSessionId: "f37c5ac7-c8da-42e3-ac3b-35e9dc523d9b",
          nonce: "TObaEXnNOfAeIgkE",
        }),
        client: createTestClient({
          id: "db5c195a-1c0b-41b2-b047-94c13a7dd30d",
        }),
        tenant: createTestTenant({
          id: "9e3d1333-efa1-4160-bbcc-ad8fe550f442",
        }),
      },
      repository: {
        browserSessionRepository: createMockRepository(() =>
          createTestBrowserSession({
            id: "ea1be311-26b3-4a75-8911-2ca1451bfee0",
            identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
          }),
        ),
        clientSessionRepository: createMockRepository(() =>
          createTestClientSession({
            id: "f37c5ac7-c8da-42e3-ac3b-35e9dc523d9b",
            audiences: ["d47d233e-9d77-4538-be99-379207440889"],
            identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
          }),
        ),
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

        authorizationSession: {
          id: "bd959ef1-6782-46ea-baff-2eabad97d967",
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
          id: "ea1be311-26b3-4a75-8911-2ca1451bfee0",
          adjustedAccessLevel: 0,
          identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
          latestAuthentication: "2021-01-01T07:59:00.000Z",
          levelOfAssurance: 2,
          methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
          remember: true,
          sso: true,
        },

        clientSession: {
          id: "f37c5ac7-c8da-42e3-ac3b-35e9dc523d9b",
          adjustedAccessLevel: 0,
          audiences: ["d47d233e-9d77-4538-be99-379207440889"],
          identityId: "46ef3e1b-032f-4c32-ac4d-fc7e8c65d093",
          latestAuthentication: "2021-01-01T07:59:00.000Z",
          levelOfAssurance: 2,
          methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
          scopes: ["openid", "profile"],
        },

        client: {
          id: "db5c195a-1c0b-41b2-b047-94c13a7dd30d",
          name: "ClientName",
          logoUri: "https://logo.uri/logo",
          type: "confidential",
        },

        tenant: {
          id: "9e3d1333-efa1-4160-bbcc-ad8fe550f442",
          name: "TenantName",
        },
      },
    });
  });
});
