import { AuthorizationSession } from "../../entity";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestConsentSession,
} from "../../fixtures/entity";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { getUpdatedConsentSession as _getUpdatedConsentSession } from "../sessions";
import { randomUUID } from "crypto";
import { handleOauthConsentVerification } from "./handle-oauth-consent-verification";
import { ServerError } from "@lindorm-io/errors";

jest.mock("../sessions");

const getUpdatedConsentSession = _getUpdatedConsentSession as jest.Mock;

describe("handleOauthConsentVerification", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationSessionCache: createMockCache(createTestAuthorizationSession),
      },
      repository: {
        browserSessionRepository: createMockRepository(createTestBrowserSession),
      },
    };

    authorizationSession = createTestAuthorizationSession({
      identifiers: {
        browserSessionId: randomUUID(),
        consentSessionId: null,
        refreshSessionId: null,
      },
    });

    getUpdatedConsentSession.mockResolvedValue(createTestConsentSession());
  });

  test("should resolve", async () => {
    await expect(handleOauthConsentVerification(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.any(AuthorizationSession),
    );
  });

  test("should throw on missing browser session id", async () => {
    authorizationSession.identifiers.browserSessionId = null;

    await expect(handleOauthConsentVerification(ctx, authorizationSession)).rejects.toThrow(
      ServerError,
    );
  });
});
