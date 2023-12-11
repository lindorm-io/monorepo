import { SessionStatus } from "@lindorm-io/common-enums";
import { createTestAuthorizationSession } from "../../fixtures/entity";
import {
  createAuthorizationRejectedUri as _createAuthorizationRejectedUri,
  createAuthorizationVerifyUri as _createAuthorizationVerifyUri,
  createConsentPendingUri as _createConsentPendingUri,
  createLoginPendingUri as _createLoginPendingUri,
  createSelectAccountPendingUri as _createSelectAccountPendingUri,
} from "../../util";
import { redirectAuthorizationController } from "./redirect-authorization";

jest.mock("../../util");

const createAuthorizationVerifyUri = _createAuthorizationVerifyUri as jest.Mock;
const createConsentPendingUri = _createConsentPendingUri as jest.Mock;
const createAuthorizationRejectedUri = _createAuthorizationRejectedUri as jest.Mock;
const createLoginPendingUri = _createLoginPendingUri as jest.Mock;
const createSelectAccountPendingUri = _createSelectAccountPendingUri as jest.Mock;

describe("redirectAuthorizationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        authorizationSession: createTestAuthorizationSession({
          status: {
            consent: SessionStatus.CONFIRMED,
            login: SessionStatus.CONFIRMED,
            selectAccount: SessionStatus.CONFIRMED,
          },
        }),
      },
    };

    createAuthorizationVerifyUri.mockReturnValue("createAuthorizationVerifyUri");
    createConsentPendingUri.mockReturnValue("createConsentPendingUri");
    createAuthorizationRejectedUri.mockReturnValue("createAuthorizationRejectedUri");
    createLoginPendingUri.mockReturnValue("createLoginPendingUri");
    createSelectAccountPendingUri.mockReturnValue("createSelectAccountPendingUri");
  });

  describe("selectAccount", () => {
    test("should redirect for confirmed", async () => {
      await expect(redirectAuthorizationController(ctx)).resolves.toStrictEqual({
        body: { redirectTo: "createAuthorizationVerifyUri" },
      });
    });

    test("should redirect for skip", async () => {
      ctx.entity.authorizationSession.status.selectAccount = "skip";

      await expect(redirectAuthorizationController(ctx)).resolves.toStrictEqual({
        body: { redirectTo: "createAuthorizationVerifyUri" },
      });
    });

    test("should redirect for pending", async () => {
      ctx.entity.authorizationSession.status.selectAccount = "pending";

      await expect(redirectAuthorizationController(ctx)).resolves.toStrictEqual({
        body: { redirectTo: "createSelectAccountPendingUri" },
      });
    });

    test("should redirect for rejected", async () => {
      ctx.entity.authorizationSession.status.selectAccount = "rejected";

      await expect(redirectAuthorizationController(ctx)).resolves.toStrictEqual({
        body: { redirectTo: "createAuthorizationRejectedUri" },
      });
    });
  });

  describe("login", () => {
    test("should redirect for confirmed", async () => {
      await expect(redirectAuthorizationController(ctx)).resolves.toStrictEqual({
        body: { redirectTo: "createAuthorizationVerifyUri" },
      });
    });

    test("should redirect for skip", async () => {
      ctx.entity.authorizationSession.status.login = "skip";

      await expect(redirectAuthorizationController(ctx)).resolves.toStrictEqual({
        body: { redirectTo: "createAuthorizationVerifyUri" },
      });
    });

    test("should redirect for pending", async () => {
      ctx.entity.authorizationSession.status.login = "pending";

      await expect(redirectAuthorizationController(ctx)).resolves.toStrictEqual({
        body: { redirectTo: "createLoginPendingUri" },
      });
    });

    test("should redirect for rejected", async () => {
      ctx.entity.authorizationSession.status.login = "rejected";

      await expect(redirectAuthorizationController(ctx)).resolves.toStrictEqual({
        body: { redirectTo: "createAuthorizationRejectedUri" },
      });
    });
  });

  describe("consent", () => {
    test("should redirect for confirmed", async () => {
      await expect(redirectAuthorizationController(ctx)).resolves.toStrictEqual({
        body: { redirectTo: "createAuthorizationVerifyUri" },
      });
    });

    test("should redirect for skip", async () => {
      ctx.entity.authorizationSession.status.consent = "skip";

      await expect(redirectAuthorizationController(ctx)).resolves.toStrictEqual({
        body: { redirectTo: "createAuthorizationVerifyUri" },
      });
    });

    test("should redirect for pending", async () => {
      ctx.entity.authorizationSession.status.consent = "pending";

      await expect(redirectAuthorizationController(ctx)).resolves.toStrictEqual({
        body: { redirectTo: "createConsentPendingUri" },
      });
    });

    test("should redirect for rejected", async () => {
      ctx.entity.authorizationSession.status.consent = "rejected";

      await expect(redirectAuthorizationController(ctx)).resolves.toStrictEqual({
        body: { redirectTo: "createAuthorizationRejectedUri" },
      });
    });
  });
});
