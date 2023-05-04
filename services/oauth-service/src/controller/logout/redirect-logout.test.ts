import { SessionStatus } from "@lindorm-io/common-types";
import { createTestLogoutSession } from "../../fixtures/entity";
import {
  createLogoutPendingUri as _createLogoutPendingUri,
  createLogoutRejectedUri as _createLogoutRejectedUri,
  createLogoutVerifyUri as _createLogoutVerifyUri,
} from "../../util";
import { redirectLogoutController } from "./redirect-logout";

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

    createLogoutVerifyUri.mockReturnValue("createLogoutVerifyUri");
    createLogoutPendingUri.mockReturnValue("createLogoutPendingUri");
    createLogoutRejectedUri.mockReturnValue("createLogoutRejectedUri");
  });

  test("should redirect for confirmed", async () => {
    await expect(redirectLogoutController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createLogoutVerifyUri" },
    });
  });

  test("should redirect for skip", async () => {
    ctx.entity.logoutSession.status = "skip";

    await expect(redirectLogoutController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createLogoutVerifyUri" },
    });
  });

  test("should redirect for pending", async () => {
    ctx.entity.logoutSession.status = "pending";

    await expect(redirectLogoutController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createLogoutPendingUri" },
    });
  });

  test("should redirect for rejected", async () => {
    ctx.entity.logoutSession.status = "rejected";

    await expect(redirectLogoutController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createLogoutRejectedUri" },
    });
  });
});
