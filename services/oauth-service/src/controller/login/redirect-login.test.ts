import { createTestAuthorizationSession } from "../../fixtures/entity";
import { redirectLoginController } from "./redirect-login";
import {
  createAuthorizationVerifyUri as _createAuthorizationVerifyUri,
  createLoginPendingUri as _createLoginPendingUri,
  createLoginRejectedUri as _createLoginRejectedUri,
} from "../../util";

jest.mock("../../util");

const createAuthorizationVerifyUri = _createAuthorizationVerifyUri as jest.Mock;
const createLoginPendingUri = _createLoginPendingUri as jest.Mock;
const createLoginRejectedUri = _createLoginRejectedUri as jest.Mock;

describe("redirectLoginController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        authorizationSession: createTestAuthorizationSession({
          status: {
            consent: "confirmed",
            login: "confirmed",
          },
        }),
      },
    };

    createAuthorizationVerifyUri.mockImplementation(() => "createAuthorizationVerifyUri");
    createLoginPendingUri.mockImplementation(() => "createLoginPendingUri");
    createLoginRejectedUri.mockImplementation(() => "createLoginRejectedUri");
  });

  test("should redirect for confirmed", async () => {
    await expect(redirectLoginController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createAuthorizationVerifyUri" },
    });
  });

  test("should redirect for skip", async () => {
    ctx.entity.authorizationSession.status.login = "skip";

    await expect(redirectLoginController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createAuthorizationVerifyUri" },
    });
  });

  test("should redirect for pending", async () => {
    ctx.entity.authorizationSession.status.login = "pending";

    await expect(redirectLoginController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createLoginPendingUri" },
    });
  });

  test("should redirect for rejected", async () => {
    ctx.entity.authorizationSession.status.login = "rejected";

    await expect(redirectLoginController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createLoginRejectedUri" },
    });
  });
});
