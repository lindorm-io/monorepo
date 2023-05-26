import {
  LindormScope,
  OpenIdClientType,
  OpenIdScope,
  SessionStatus,
} from "@lindorm-io/common-types";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import { mockFetchOauthAuthorizationSession } from "../../../fixtures/axios";
import {
  confirmOauthConsent as _confirmOauthConsent,
  getOauthAuthorizationRedirect as _getOauthAuthorizationRedirect,
  getOauthAuthorizationSession as _getOauthAuthorizationSession,
} from "../../../handler";
import { redirectConsentSessionController } from "./redirect-consent-session";

jest.mock("../../../handler");

const confirmOauthConsent = _confirmOauthConsent as jest.Mock;
const getOauthAuthorizationRedirect = _getOauthAuthorizationRedirect as jest.Mock;
const getOauthAuthorizationSession = _getOauthAuthorizationSession as jest.Mock;

describe("redirectConsentSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        session: "f771592d-e4f6-418f-8faa-f5ea757062aa",
      },
      logger: createMockLogger(),
    };

    confirmOauthConsent.mockResolvedValue({
      redirectTo: "confirmOauthConsent",
    });
    getOauthAuthorizationRedirect.mockResolvedValue({
      redirectTo: "getOauthAuthorizationRedirect",
    });
    getOauthAuthorizationSession.mockResolvedValue(mockFetchOauthAuthorizationSession());
  });

  test("should resolve url", async () => {
    await expect(redirectConsentSessionController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });
  });

  test("should resolve redirect", async () => {
    getOauthAuthorizationSession.mockResolvedValue(
      mockFetchOauthAuthorizationSession({
        consent: {
          isRequired: true,
          status: SessionStatus.CONFIRMED,

          audiences: [randomUUID()],
          optionalScopes: Object.values(LindormScope),
          requiredScopes: Object.values(OpenIdScope),
          scopeDescriptions: [],
        },
      }),
    );

    await expect(redirectConsentSessionController(ctx)).resolves.toStrictEqual({
      redirect: "getOauthAuthorizationRedirect",
    });
  });

  test("should resolve confirm", async () => {
    getOauthAuthorizationSession.mockResolvedValue(
      mockFetchOauthAuthorizationSession({
        client: {
          id: randomUUID(),
          name: "Test Client",
          logoUri: "https://test.client.com/logo.png",
          singleSignOn: true,
          type: OpenIdClientType.CONFIDENTIAL,
        },
      }),
    );

    await expect(redirectConsentSessionController(ctx)).resolves.toStrictEqual({
      redirect: "confirmOauthConsent",
    });
  });
});
