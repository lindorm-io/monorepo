import { OpenIdScope } from "@lindorm-io/common-types";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { AuthorizationRequest, Client } from "../../entity";
import {
  createTestAuthorizationRequest,
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
  let authorizationRequest: AuthorizationRequest;
  let client: Client;

  beforeEach(() => {
    ctx = {
      redis: {
        authorizationRequestCache: createMockRedisRepository(createTestAuthorizationRequest),
      },
      mongo: {
        browserSessionRepository: createMockMongoRepository(createTestBrowserSession),
      },
    };

    authorizationRequest = createTestAuthorizationRequest();
    authorizationRequest.confirmedConsent.scopes = [OpenIdScope.OPENID];

    client = createTestClient();

    getUpdatedClientSession.mockResolvedValue(createTestClientSession());
  });

  afterEach(jest.resetAllMocks);

  test("should resolve", async () => {
    await expect(
      handleOauthConsentVerification(ctx, authorizationRequest, client),
    ).resolves.toStrictEqual(expect.any(AuthorizationRequest));

    expect(ctx.redis.authorizationRequestCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: expect.objectContaining({
          consent: "verified",
        }),
      }),
    );
  });

  test("should resolve client session", async () => {
    authorizationRequest.confirmedConsent.scopes.push(OpenIdScope.OFFLINE_ACCESS);

    await expect(
      handleOauthConsentVerification(ctx, authorizationRequest, client),
    ).resolves.toStrictEqual(expect.any(AuthorizationRequest));

    expect(getUpdatedClientSession).toHaveBeenCalled();

    expect(ctx.redis.authorizationRequestCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        clientSessionId: expect.any(String),
      }),
    );
  });
});
