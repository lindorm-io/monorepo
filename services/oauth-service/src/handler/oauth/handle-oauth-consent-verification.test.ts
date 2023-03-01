import { AuthorizationSession, Client } from "../../entity";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { handleOauthConsentVerification } from "./handle-oauth-consent-verification";
import {
  createTestAccessSession,
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestRefreshSession,
} from "../../fixtures/entity";
import {
  getUpdatedAccessSession as _getUpdatedAccessSession,
  getUpdatedRefreshSession as _getUpdatedRefreshSession,
} from "../sessions";
import { OpenIdScope } from "@lindorm-io/common-types";

jest.mock("../sessions");

const getUpdatedAccessSession = _getUpdatedAccessSession as jest.Mock;
const getUpdatedRefreshSession = _getUpdatedRefreshSession as jest.Mock;

describe("handleOauthConsentVerification", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;
  let client: Client;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationSessionCache: createMockCache(createTestAuthorizationSession),
      },
      repository: {
        browserSessionRepository: createMockRepository(createTestBrowserSession),
      },
    };

    authorizationSession = createTestAuthorizationSession();
    authorizationSession.confirmedConsent.scopes = [OpenIdScope.OPENID];

    client = createTestClient();

    getUpdatedAccessSession.mockResolvedValue(createTestAccessSession());
    getUpdatedRefreshSession.mockResolvedValue(createTestRefreshSession());
  });

  afterEach(jest.resetAllMocks);

  test("should resolve", async () => {
    await expect(
      handleOauthConsentVerification(ctx, authorizationSession, client),
    ).resolves.toStrictEqual(expect.any(AuthorizationSession));

    expect(ctx.cache.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: expect.objectContaining({
          consent: "verified",
        }),
      }),
    );
  });

  test("should resolve refresh session", async () => {
    authorizationSession.confirmedConsent.scopes.push(OpenIdScope.OFFLINE_ACCESS);

    await expect(
      handleOauthConsentVerification(ctx, authorizationSession, client),
    ).resolves.toStrictEqual(expect.any(AuthorizationSession));

    expect(getUpdatedRefreshSession).toHaveBeenCalled();

    expect(ctx.cache.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        accessSessionId: null,
        refreshSessionId: expect.any(String),
      }),
    );
  });

  test("should resolve access session", async () => {
    await expect(
      handleOauthConsentVerification(ctx, authorizationSession, client),
    ).resolves.toStrictEqual(expect.any(AuthorizationSession));

    expect(getUpdatedAccessSession).toHaveBeenCalled();

    expect(ctx.cache.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        accessSessionId: expect.any(String),
        refreshSessionId: null,
      }),
    );
  });
});
