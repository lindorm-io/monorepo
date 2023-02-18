import { AuthorizationSession } from "../../entity";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestAuthorizationSession, createTestBrowserSession } from "../../fixtures/entity";
import { getUpdatedBrowserSession as _getUpdatedBrowserSession } from "../sessions";
import { handleOauthLoginVerification } from "./handle-oauth-login-verification";
import {
  getBrowserSessionCookies as _getBrowserSessionCookies,
  setBrowserSessionCookies as _setBrowserSessionCookies,
} from "../cookies";

jest.mock("../cookies");
jest.mock("../sessions");

const getBrowserSessionCookies = _getBrowserSessionCookies as jest.Mock;
const setBrowserSessionCookies = _setBrowserSessionCookies as jest.Mock;
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

    getUpdatedBrowserSession.mockResolvedValue(
      createTestBrowserSession({ id: "65c04ad2-6b10-4eb4-ac8e-6df5911968ec" }),
    );

    getBrowserSessionCookies.mockImplementation(() => ["c27d4370-b1bf-4f34-91c4-54314a01228e"]);
    setBrowserSessionCookies.mockImplementation();
  });

  test("should resolve", async () => {
    await expect(handleOauthLoginVerification(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.any(AuthorizationSession),
    );

    expect(getBrowserSessionCookies).toHaveBeenCalled();
    expect(setBrowserSessionCookies).toHaveBeenCalledWith(expect.any(Object), [
      "65c04ad2-6b10-4eb4-ac8e-6df5911968ec",
      "c27d4370-b1bf-4f34-91c4-54314a01228e",
    ]);

    expect(ctx.cache.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        browserSessionId: "65c04ad2-6b10-4eb4-ac8e-6df5911968ec",
        status: expect.objectContaining({
          login: "verified",
        }),
      }),
    );
  });
});
