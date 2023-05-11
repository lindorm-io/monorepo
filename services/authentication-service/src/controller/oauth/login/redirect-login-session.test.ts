import {
  AuthenticationMethod,
  OpenIdDisplayMode,
  OpenIdPromptMode,
  SessionStatus,
} from "@lindorm-io/common-types";
import { randomString } from "@lindorm-io/random";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import { mockFetchOauthAuthorizationSession } from "../../../fixtures/axios";
import { createTestAuthenticationConfirmationToken } from "../../../fixtures/entity";
import {
  confirmOauthLogin as _confirmOauthLogin,
  getOauthAuthorizationRedirect as _getOauthAuthorizationRedirect,
  getOauthAuthorizationSession as _getOauthAuthorizationSession,
  resolveAuthenticationConfirmationToken as _resolveAuthenticationConfirmationToken,
} from "../../../handler";
import { redirectLoginSessionController } from "./redirect-login-session";

jest.mock("../../../handler");

const confirmOauthLogin = _confirmOauthLogin as jest.Mock;
const getOauthAuthorizationRedirect = _getOauthAuthorizationRedirect as jest.Mock;
const getOauthAuthorizationSession = _getOauthAuthorizationSession as jest.Mock;
const resolveAuthenticationConfirmationToken = _resolveAuthenticationConfirmationToken as jest.Mock;

describe("redirectLoginSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        session: "49d276eb-4200-48b6-a1c4-53f08929cdcd",
      },
      logger: createMockLogger(),
    };

    confirmOauthLogin.mockResolvedValue({ redirectTo: "confirmOauthLogin" });
    getOauthAuthorizationRedirect.mockResolvedValue({
      redirectTo: "getOauthAuthorizationRedirect",
    });
    getOauthAuthorizationSession.mockResolvedValue(mockFetchOauthAuthorizationSession());
    resolveAuthenticationConfirmationToken.mockResolvedValue(
      createTestAuthenticationConfirmationToken({
        sessionId: "49d276eb-4200-48b6-a1c4-53f08929cdcd",
      }),
    );
  });

  test("should resolve", async () => {
    await expect(redirectLoginSessionController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });
  });

  test("should resolve auth token", async () => {
    getOauthAuthorizationSession.mockResolvedValue(
      mockFetchOauthAuthorizationSession({
        authorizationSession: {
          id: randomUUID(),
          authToken: "auth.jwt.jwt",
          country: "se",
          displayMode: OpenIdDisplayMode.PAGE,
          expires: "2022-01-01T04:00:00.000Z",
          idTokenHint: "id.jwt.jwt",
          loginHint: ["test@lindorm.io"],
          maxAge: 500,
          nonce: randomString(16),
          originalUri: "https://oauth.lindorm.io/oauth2/authorize?query=query",
          promptModes: [
            OpenIdPromptMode.CONSENT,
            OpenIdPromptMode.LOGIN,
            OpenIdPromptMode.SELECT_ACCOUNT,
          ],
          redirectUri: "https://test.client.com/redirect",
          uiLocales: ["en-GB", "sv-SE"],
        },
      }),
    );

    await expect(redirectLoginSessionController(ctx)).resolves.toStrictEqual({
      redirect: "confirmOauthLogin",
    });
  });

  test("should resolve redirect", async () => {
    getOauthAuthorizationSession.mockResolvedValue(
      mockFetchOauthAuthorizationSession({
        login: {
          isRequired: true,
          status: SessionStatus.CONFIRMED,

          identityId: randomUUID(),
          minimumLevel: 2,
          recommendedLevel: 2,
          recommendedMethods: [AuthenticationMethod.EMAIL],
          requiredLevel: 2,
          requiredMethods: [AuthenticationMethod.EMAIL],
        },
      }),
    );

    await expect(redirectLoginSessionController(ctx)).resolves.toStrictEqual({
      redirect: "getOauthAuthorizationRedirect",
    });
  });
});
