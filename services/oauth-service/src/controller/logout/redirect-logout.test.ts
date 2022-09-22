import { createTestLogoutSession } from "../../fixtures/entity";
import { SessionStatus } from "../../common";
import { redirectLogoutController } from "./redirect-logout";
import {
  createLogoutVerifyUri as _createLogoutVerifyUri,
  createLogoutPendingUri as _createLogoutPendingUri,
  createLogoutRejectedUri as _createLogoutRejectedUri,
} from "../../util";

jest.mock("../../util");

const createLogoutVerifyUri = _createLogoutVerifyUri as jest.Mock;
const createLogoutPendingUri = _createLogoutPendingUri as jest.Mock;
const createLogoutRejectedUri = _createLogoutRejectedUri as jest.Mock;

describe("redirectLogoutController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        logoutSession: createTestLogoutSession({
          status: SessionStatus.CONFIRMED,
        }),
      },
    };

    createLogoutVerifyUri.mockImplementation(() => "createLogoutVerifyUri");
    createLogoutPendingUri.mockImplementation(() => "createLogoutPendingUri");
    createLogoutRejectedUri.mockImplementation(() => "createLogoutRejectedUri");
  });

  test("should redirect for confirmed", async () => {
    await expect(redirectLogoutController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createLogoutVerifyUri" },
    });
  });

  test("should redirect for skip", async () => {
    ctx.entity.logoutSession.status = SessionStatus.SKIP;

    await expect(redirectLogoutController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createLogoutVerifyUri" },
    });
  });

  test("should redirect for pending", async () => {
    ctx.entity.logoutSession.status = SessionStatus.PENDING;

    await expect(redirectLogoutController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createLogoutPendingUri" },
    });
  });

  test("should redirect for rejected", async () => {
    ctx.entity.logoutSession.status = SessionStatus.REJECTED;

    await expect(redirectLogoutController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createLogoutRejectedUri" },
    });
  });
});
