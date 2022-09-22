import MockDate from "mockdate";
import { createMockRepository } from "@lindorm-io/mongo";
import { getConsentDataController } from "./get-consent-data";
import { isConsentRequired as _isConsentRequired } from "../../util";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestConsentSession,
} from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const isConsentRequired = _isConsentRequired as jest.Mock;

describe("getConsentInfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        authorizationSession: createTestAuthorizationSession({
          id: "2ceb59b3-3440-4e3c-9ce6-9ec1014be4dc",
          requestedConsent: {
            audiences: ["cdbb8588-f29f-47c5-b459-dc46f11fd278"],
            scopes: ["openid"],
          },
        }),
        client: createTestClient(),
      },
      repository: {
        browserSessionRepository: createMockRepository(createTestBrowserSession),
        consentSessionRepository: createMockRepository(createTestConsentSession),
      },
    };

    isConsentRequired.mockImplementation(() => true);
  });

  test("should resolve", async () => {
    await expect(getConsentDataController(ctx)).resolves.toStrictEqual({
      body: {
        authorizationSession: {
          id: "2ceb59b3-3440-4e3c-9ce6-9ec1014be4dc",
          displayMode: "popup",
          expiresAt: "2021-01-02T08:00:00.000Z",
          expiresIn: 86400,
          originalUri: "https://localhost/oauth2/authorize?query=query",
          promptModes: ["login", "consent"],
          uiLocales: ["sv-SE", "en-GB"],
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
        consentRequired: true,
        consentSession: {
          audiences: [
            "411ab157-e9df-4be8-a607-c5452a5d6d55",
            "70e9d574-be33-47a2-bcfb-e596c2170bb1",
          ],
          scopes: ["openid", "email", "profile"],
        },
        consentStatus: "pending",
        requested: {
          audiences: ["cdbb8588-f29f-47c5-b459-dc46f11fd278"],
          scopes: ["openid"],
        },
      },
    });
  });
});
