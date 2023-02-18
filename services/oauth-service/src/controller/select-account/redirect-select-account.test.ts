import { createTestAuthorizationSession } from "../../fixtures/entity";
import { redirectSelectAccountController } from "./redirect-select-account";
import {
  createAuthorizationVerifyUri as _createAuthorizationVerifyUri,
  createSelectAccountPendingUri as _createSelectAccountPendingUri,
  createSelectAccountRejectedUri as _createSelectAccountRejectedUri,
} from "../../util";

jest.mock("../../util");

const createAuthorizationVerifyUri = _createAuthorizationVerifyUri as jest.Mock;
const createSelectAccountPendingUri = _createSelectAccountPendingUri as jest.Mock;
const createSelectAccountRejectedUri = _createSelectAccountRejectedUri as jest.Mock;

describe("redirectSelectAccountController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        authorizationSession: createTestAuthorizationSession({
          status: {
            consent: "confirmed",
            login: "confirmed",
            selectAccount: "confirmed",
          },
        }),
      },
    };

    createAuthorizationVerifyUri.mockImplementation(() => "createAuthorizationVerifyUri");
    createSelectAccountPendingUri.mockImplementation(() => "createSelectAccountPendingUri");
    createSelectAccountRejectedUri.mockImplementation(() => "createSelectAccountRejectedUri");
  });

  test("should redirect for confirmed", async () => {
    await expect(redirectSelectAccountController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createAuthorizationVerifyUri" },
    });
  });

  test("should redirect for skip", async () => {
    ctx.entity.authorizationSession.status.selectAccount = "skip";

    await expect(redirectSelectAccountController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createAuthorizationVerifyUri" },
    });
  });

  test("should redirect for pending", async () => {
    ctx.entity.authorizationSession.status.selectAccount = "pending";

    await expect(redirectSelectAccountController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createSelectAccountPendingUri" },
    });
  });

  test("should redirect for rejected", async () => {
    ctx.entity.authorizationSession.status.selectAccount = "rejected";

    await expect(redirectSelectAccountController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createSelectAccountRejectedUri" },
    });
  });
});
