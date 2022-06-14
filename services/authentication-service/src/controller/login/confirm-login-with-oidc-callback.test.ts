import MockDate from "mockdate";
import { confirmLoginWithOidcCallbackController } from "./confirm-login-with-oidc-callback";
import { createMockCache } from "@lindorm-io/redis";
import { createTestLoginSession } from "../../fixtures/entity";
import {
  confirmOauthAuthenticationSession as _confirmOauthAuthenticationSession,
  fetchOidcSessionInfo as _fetchOidcSessionInfo,
} from "../../handler";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const confirmOauthAuthenticationSession = _confirmOauthAuthenticationSession as jest.Mock;
const fetchOidcSessionInfo = _fetchOidcSessionInfo as jest.Mock;

describe("confirmLoginWithOidcCallbackController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        loginSessionCache: createMockCache(createTestLoginSession),
      },
      data: {
        sessionId: "81197e58-2666-4a93-9888-8bee3992e90e",
      },
      entity: {
        loginSession: createTestLoginSession(),
      },
      deleteCookie: jest.fn(),
    };

    confirmOauthAuthenticationSession.mockResolvedValue({ redirectTo: "https://confirm" });
    fetchOidcSessionInfo.mockResolvedValue({
      identityId: "1e9c846c-2212-4fce-898a-83363e5f88d5",
      levelOfAssurance: 2,
      provider: "apple",
    });
  });

  test("should resolve", async () => {
    await expect(confirmLoginWithOidcCallbackController(ctx)).resolves.toStrictEqual({
      redirect: "https://confirm",
    });

    expect(confirmOauthAuthenticationSession).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      {
        acrValues: ["loa_2"],
        amrValues: ["oidc_apple"],
        identityId: "1e9c846c-2212-4fce-898a-83363e5f88d5",
        levelOfAssurance: 2,
        remember: false,
      },
    );

    expect(ctx.cache.loginSessionCache.destroy).toHaveBeenCalled();
    expect(ctx.deleteCookie).toHaveBeenCalled();
  });
});
