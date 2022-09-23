import { AuthorizationSession } from "../../entity";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestAuthorizationSession, createTestBrowserSession } from "../../fixtures/entity";
import { getUpdatedBrowserSession as _getUpdatedBrowserSession } from "../sessions";
import { handleOauthLoginVerification } from "./handle-oauth-login-verification";
import { setBrowserSessionCookie as _setBrowserSessionCookie } from "../cookies";

jest.mock("../cookies");
jest.mock("../sessions");

const setBrowserSessionCookie = _setBrowserSessionCookie as jest.Mock;
const getUpdatedBrowserSession = _getUpdatedBrowserSession as jest.Mock;

describe("handleOauthLoginVerification", () => {
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

    authorizationSession = createTestAuthorizationSession();

    setBrowserSessionCookie.mockImplementation();
    getUpdatedBrowserSession.mockResolvedValue(createTestBrowserSession());
  });

  test("should resolve", async () => {
    await expect(handleOauthLoginVerification(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.any(AuthorizationSession),
    );

    expect(setBrowserSessionCookie).toHaveBeenCalled();
  });
});
