import { AuthorizationSession, Client } from "../../entity";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { handleOauthConsentVerification } from "./handle-oauth-consent-verification";
import { getUpdatedClientSession as _getUpdatedClientSession } from "../sessions";
import { OpenIdScope } from "@lindorm-io/common-types";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";

jest.mock("../sessions");

const getUpdatedClientSession = _getUpdatedClientSession as jest.Mock;

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

    getUpdatedClientSession.mockResolvedValue(createTestClientSession());
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

  test("should resolve client session", async () => {
    authorizationSession.confirmedConsent.scopes.push(OpenIdScope.OFFLINE_ACCESS);

    await expect(
      handleOauthConsentVerification(ctx, authorizationSession, client),
    ).resolves.toStrictEqual(expect.any(AuthorizationSession));

    expect(getUpdatedClientSession).toHaveBeenCalled();

    expect(ctx.cache.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        clientSessionId: expect.any(String),
      }),
    );
  });
});
