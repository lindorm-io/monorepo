import { Scope } from "@lindorm-io/common-enums";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { AuthorizationSession, Client } from "../../entity";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";
import { getUpdatedClientSession as _getUpdatedClientSession } from "../sessions";
import { handleOauthConsentVerification } from "./handle-oauth-consent-verification";

jest.mock("../sessions");

const getUpdatedClientSession = _getUpdatedClientSession as jest.Mock;

describe("handleOauthConsentVerification", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;
  let client: Client;

  beforeEach(() => {
    ctx = {
      redis: {
        authorizationSessionCache: createMockRedisRepository(createTestAuthorizationSession),
      },
      mongo: {
        browserSessionRepository: createMockMongoRepository(createTestBrowserSession),
      },
    };

    authorizationSession = createTestAuthorizationSession();
    authorizationSession.confirmedConsent.scopes = [Scope.OPENID];

    client = createTestClient();

    getUpdatedClientSession.mockResolvedValue(createTestClientSession());
  });

  afterEach(jest.resetAllMocks);

  test("should resolve", async () => {
    await expect(
      handleOauthConsentVerification(ctx, authorizationSession, client),
    ).resolves.toStrictEqual(expect.any(AuthorizationSession));

    expect(ctx.redis.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: expect.objectContaining({
          consent: "verified",
        }),
      }),
    );
  });

  test("should resolve client session", async () => {
    authorizationSession.confirmedConsent.scopes.push(Scope.OFFLINE_ACCESS);

    await expect(
      handleOauthConsentVerification(ctx, authorizationSession, client),
    ).resolves.toStrictEqual(expect.any(AuthorizationSession));

    expect(getUpdatedClientSession).toHaveBeenCalled();

    expect(ctx.redis.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        clientSessionId: expect.any(String),
      }),
    );
  });
});
