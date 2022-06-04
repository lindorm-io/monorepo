import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { LogoutSessionType } from "../../enum";
import { SessionStatus } from "../../common";
import { confirmLogoutController } from "./confirm-logout";
import { createLogoutVerifyRedirectUri as _createLogoutVerifyRedirectUri } from "../../util";
import { createMockLogger } from "@lindorm-io/winston";
import { getTestLogoutSession } from "../../test/entity";
import {
  handleBrowserSessionLogout as _handleBrowserSessionLogout,
  handleRefreshSessionLogout as _handleRefreshSessionLogout,
} from "../../handler";
import { createMockCache } from "@lindorm-io/redis";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");
jest.mock("../../util");

const createLogoutVerifyRedirectUri = _createLogoutVerifyRedirectUri as jest.Mock;
const handleBrowserSessionLogout = _handleBrowserSessionLogout as jest.Mock;
const handleRefreshSessionLogout = _handleRefreshSessionLogout as jest.Mock;

describe("confirmLogoutController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        logoutSessionCache: createMockCache(),
      },
      entity: {
        logoutSession: getTestLogoutSession({
          sessionType: LogoutSessionType.BROWSER,
        }),
      },
      logger: createMockLogger(),
    };

    createLogoutVerifyRedirectUri.mockImplementation(() => "redirect-uri");
  });

  test("should resolve for browser session", async () => {
    await expect(confirmLogoutController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "redirect-uri" },
    });

    expect(ctx.cache.logoutSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: SessionStatus.CONFIRMED,
      }),
    );
    expect(handleBrowserSessionLogout).toHaveBeenCalled();
  });

  test("should resolve for refresh session", async () => {
    ctx.entity.logoutSession = getTestLogoutSession({
      sessionType: LogoutSessionType.REFRESH,
    });

    await expect(confirmLogoutController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "redirect-uri" },
    });

    expect(ctx.cache.logoutSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: SessionStatus.CONFIRMED,
      }),
    );
    expect(handleRefreshSessionLogout).toHaveBeenCalled();
  });

  test("should throw on invalid status", async () => {
    ctx.entity.logoutSession.status = SessionStatus.CONFIRMED;

    await expect(confirmLogoutController(ctx)).rejects.toThrow(ClientError);
  });
});
