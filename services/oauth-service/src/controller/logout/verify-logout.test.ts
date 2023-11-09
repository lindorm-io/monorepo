import { SessionStatus } from "@lindorm-io/common-enums";
import { ClientError } from "@lindorm-io/errors";
import { randomUUID } from "crypto";
import { createTestClient, createTestLogoutSession } from "../../fixtures/entity";
import {
  handleBrowserSessionLogout as _handleBrowserSessionLogout,
  handleClientSessionLogout as _handleClientSessionLogout,
} from "../../handler";
import {
  createLogoutPendingUri as _createLogoutPendingUri,
  createLogoutRedirectUri as _createLogoutRedirectUri,
  createLogoutRejectedUri as _createLogoutRejectedUri,
} from "../../util";
import { verifyLogoutController } from "./verify-logout";

jest.mock("../../handler");
jest.mock("../../util");

const handleBrowserSessionLogout = _handleBrowserSessionLogout as jest.Mock;
const handleClientSessionLogout = _handleClientSessionLogout as jest.Mock;

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
            clientSessionId: randomUUID(),
            browserSessionId: randomUUID(),
          },
          status: SessionStatus.CONFIRMED,
        }),
      },
      cookies: {
        set: jest.fn(),
      },
    };

    handleBrowserSessionLogout.mockResolvedValue(undefined);
    handleClientSessionLogout.mockResolvedValue(undefined);

    createLogoutPendingUri.mockReturnValue("createLogoutPendingUri");
    createLogoutRedirectUri.mockReturnValue("createLogoutRedirectUri");
    createLogoutRejectedUri.mockReturnValue("createLogoutRejectedUri");
  });

  afterEach(jest.clearAllMocks);

  test("should resolve", async () => {
    await expect(verifyLogoutController(ctx)).resolves.toStrictEqual({
      redirect: "createLogoutRedirectUri",
    });

    expect(handleBrowserSessionLogout).toHaveBeenCalled();
    expect(handleClientSessionLogout).toHaveBeenCalled();
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
