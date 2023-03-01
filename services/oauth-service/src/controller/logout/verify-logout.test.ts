import { ClientError } from "@lindorm-io/errors";
import { createTestClient, createTestLogoutSession } from "../../fixtures/entity";
import { randomUUID } from "crypto";
import { verifyLogoutController } from "./verify-logout";
import {
  handleAccessSessionLogout as _handleAccessSessionLogout,
  handleBrowserSessionLogout as _handleBrowserSessionLogout,
  handleRefreshSessionLogout as _handleRefreshSessionLogout,
} from "../../handler";
import {
  createLogoutPendingUri as _createLogoutPendingUri,
  createLogoutRedirectUri as _createLogoutRedirectUri,
  createLogoutRejectedUri as _createLogoutRejectedUri,
} from "../../util";
import { SessionStatus } from "@lindorm-io/common-types";

jest.mock("../../handler");
jest.mock("../../util");

const handleAccessSessionLogout = _handleAccessSessionLogout as jest.Mock;
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
        postLogoutRedirectUri: "https://test.client.lindorm.io/logout",
      },
      entity: {
        client: createTestClient(),
        logoutSession: createTestLogoutSession({
          confirmedLogout: {
            accessSessionId: randomUUID(),
            refreshSessionId: randomUUID(),
            browserSessionId: randomUUID(),
          },
          status: SessionStatus.CONFIRMED,
        }),
      },
      cookies: {
        set: jest.fn(),
      },
    };

    handleAccessSessionLogout.mockResolvedValue(undefined);
    handleBrowserSessionLogout.mockResolvedValue(undefined);
    handleRefreshSessionLogout.mockResolvedValue(undefined);

    createLogoutPendingUri.mockImplementation(() => "createLogoutPendingUri");
    createLogoutRedirectUri.mockImplementation(() => "createLogoutRedirectUri");
    createLogoutRejectedUri.mockImplementation(() => "createLogoutRejectedUri");
  });

  afterEach(jest.clearAllMocks);

  test("should resolve", async () => {
    await expect(verifyLogoutController(ctx)).resolves.toStrictEqual({
      redirect: "createLogoutRedirectUri",
    });

    expect(handleAccessSessionLogout).toHaveBeenCalled();
    expect(handleBrowserSessionLogout).toHaveBeenCalled();
    expect(handleRefreshSessionLogout).toHaveBeenCalled();
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
    ctx.data.postLogoutRedirectUri = "wrong";

    await expect(verifyLogoutController(ctx)).rejects.toThrow(ClientError);
  });
});
