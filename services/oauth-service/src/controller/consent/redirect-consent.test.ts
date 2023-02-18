import { createTestAuthorizationSession } from "../../fixtures/entity";
import { redirectConsentController } from "./redirect-consent";
import {
  createAuthorizationVerifyUri as _createAuthorizationVerifyUri,
  createConsentPendingUri as _createConsentPendingUri,
  createConsentRejectedUri as _createConsentRejectedUri,
} from "../../util";

jest.mock("../../util");

const createAuthorizationVerifyUri = _createAuthorizationVerifyUri as jest.Mock;
const createConsentPendingUri = _createConsentPendingUri as jest.Mock;
const createConsentRejectedUri = _createConsentRejectedUri as jest.Mock;

describe("redirectConsentController", () => {
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
    createConsentPendingUri.mockImplementation(() => "createConsentPendingUri");
    createConsentRejectedUri.mockImplementation(() => "createConsentRejectedUri");
  });

  test("should redirect for confirmed", async () => {
    await expect(redirectConsentController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createAuthorizationVerifyUri" },
    });
  });

  test("should redirect for skip", async () => {
    ctx.entity.authorizationSession.status.consent = "skip";

    await expect(redirectConsentController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createAuthorizationVerifyUri" },
    });
  });

  test("should redirect for pending", async () => {
    ctx.entity.authorizationSession.status.consent = "pending";

    await expect(redirectConsentController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createConsentPendingUri" },
    });
  });

  test("should redirect for rejected", async () => {
    ctx.entity.authorizationSession.status.consent = "rejected";

    await expect(redirectConsentController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createConsentRejectedUri" },
    });
  });
});
