import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  SessionStatus,
} from "@lindorm-io/common-types";
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

  test("should resolve redirect", async () => {
    getOauthAuthorizationSession.mockResolvedValue(
      mockFetchOauthAuthorizationSession({
        login: {
          isRequired: true,
          status: SessionStatus.CONFIRMED,

          factors: [AuthenticationFactor.ONE_FACTOR],
          identityId: randomUUID(),
          levelOfAssurance: 2,
          methods: [AuthenticationMethod.EMAIL],
          minimumLevelOfAssurance: 2,
          strategies: [AuthenticationStrategy.EMAIL_OTP],
        },
      }),
    );

    await expect(redirectLoginSessionController(ctx)).resolves.toStrictEqual({
      redirect: "getOauthAuthorizationRedirect",
    });
  });
});
