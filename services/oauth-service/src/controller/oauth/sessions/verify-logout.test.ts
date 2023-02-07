import { ClientError } from "@lindorm-io/errors";
import { LogoutSessionType } from "../../../enum";
import { createTestLogoutSession } from "../../../fixtures/entity";
import { verifyLogoutController } from "./verify-logout";
import {
  handleBrowserSessionLogout as _handleBrowserSessionLogout,
  handleRefreshSessionLogout as _handleRefreshSessionLogout,
} from "../../../handler";
import {
  createLogoutPendingUri as _createLogoutPendingUri,
  createLogoutRedirectUri as _createLogoutRedirectUri,
  createLogoutRejectedUri as _createLogoutRejectedUri,
} from "../../../util";

jest.mock("../../../handler");
jest.mock("../../../util");

const handleBrowserSessionLogout = _handleBrowserSessionLogout as jest.Mock;
const handleRefreshSessionLogout = _handleRefreshSessionLogout as jest.Mock;

const createLogoutPendingUri = _createLogoutPendingUri as jest.Mock;
const createLogoutRedirectUri = _createLogoutRedirectUri as jest.Mock;
const createLogoutRejectedUri = _createLogoutRejectedUri as jest.Mock;

describe("oauthVerifyLogoutController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        redirectUri: "https://test.client.lindorm.io/redirect",
      },
      entity: {
        logoutSession: createTestLogoutSession({
          id: "ba965b10-44b4-4ec0-b276-10ac52f9d43f",
          status: "confirmed",
          sessionType: LogoutSessionType.REFRESH,
          state: "YuTs0Kaf8UV1I086TptUqz1Yh1PNoJow",
        }),
      },
      cookies: {
        set: jest.fn(),
      },
    };

    handleBrowserSessionLogout.mockResolvedValue(undefined);
    handleRefreshSessionLogout.mockResolvedValue(undefined);

    createLogoutPendingUri.mockImplementation(() => "createLogoutPendingUri");
    createLogoutRedirectUri.mockImplementation(() => "createLogoutRedirectUri");
    createLogoutRejectedUri.mockImplementation(() => "createLogoutRejectedUri");
  });

  afterEach(jest.clearAllMocks);

  test("should resolve for browser session", async () => {
    ctx.entity.logoutSession = createTestLogoutSession({
      status: "confirmed",
      sessionType: LogoutSessionType.BROWSER,
    });

    await expect(verifyLogoutController(ctx)).resolves.toStrictEqual({
      redirect: "createLogoutRedirectUri",
    });

    expect(handleBrowserSessionLogout).toHaveBeenCalled();
    expect(handleRefreshSessionLogout).not.toHaveBeenCalled();
    expect(ctx.cookies.set).toHaveBeenCalledTimes(1);
  });

  test("should resolve for refresh session", async () => {
    ctx.entity.logoutSession = createTestLogoutSession({
      status: "confirmed",
      sessionType: LogoutSessionType.REFRESH,
    });

    await expect(verifyLogoutController(ctx)).resolves.toStrictEqual({
      redirect: "createLogoutRedirectUri",
    });

    expect(handleBrowserSessionLogout).not.toHaveBeenCalled();
    expect(handleRefreshSessionLogout).toHaveBeenCalled();
    expect(ctx.cookies.set).not.toHaveBeenCalled();
  });

  test("should resolve pending logout redirect", async () => {
    ctx.entity.logoutSession.status = "pending";

    await expect(verifyLogoutController(ctx)).resolves.toStrictEqual({
      redirect: "createLogoutPendingUri",
    });

    expect(ctx.cookies.set).not.toHaveBeenCalled();
  });

  test("should resolve rejected logout redirect", async () => {
    ctx.entity.logoutSession.status = "rejected";

    await expect(verifyLogoutController(ctx)).resolves.toStrictEqual({
      redirect: "createLogoutRejectedUri",
    });

    expect(ctx.cookies.set).not.toHaveBeenCalled();
  });

  test("should throw on invalid redirect uri", async () => {
    ctx.data.redirectUri = "wrong";

    await expect(verifyLogoutController(ctx)).rejects.toThrow(ClientError);
  });
});
