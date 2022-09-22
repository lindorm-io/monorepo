import { createTestAuthorizationSession } from "../../fixtures/entity";
import { SessionStatus } from "../../common";
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
            consent: SessionStatus.CONFIRMED,
            login: SessionStatus.CONFIRMED,
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
    ctx.entity.authorizationSession.status.consent = SessionStatus.SKIP;

    await expect(redirectConsentController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createAuthorizationVerifyUri" },
    });
  });

  test("should redirect for pending", async () => {
    ctx.entity.authorizationSession.status.consent = SessionStatus.PENDING;

    await expect(redirectConsentController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createConsentPendingUri" },
    });
  });

  test("should redirect for rejected", async () => {
    ctx.entity.authorizationSession.status.consent = SessionStatus.REJECTED;

    await expect(redirectConsentController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createConsentRejectedUri" },
    });
  });
});
