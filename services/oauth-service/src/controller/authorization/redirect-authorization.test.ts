import { SessionStatus } from "@lindorm-io/common-enums";
import { createTestAuthorizationSession } from "../../fixtures/entity";
import {
  createAuthorizationVerifyUri as _createAuthorizationVerifyUri,
  createConsentPendingUri as _createConsentPendingUri,
  createConsentRejectedUri as _createConsentRejectedUri,
  createLoginPendingUri as _createLoginPendingUri,
  createLoginRejectedUri as _createLoginRejectedUri,
  createSelectAccountPendingUri as _createSelectAccountPendingUri,
  createSelectAccountRejectedUri as _createSelectAccountRejectedUri,
} from "../../util";
import { redirectAuthorizationController } from "./redirect-authorization";

jest.mock("../../util");

const createAuthorizationVerifyUri = _createAuthorizationVerifyUri as jest.Mock;
const createConsentPendingUri = _createConsentPendingUri as jest.Mock;
const createConsentRejectedUri = _createConsentRejectedUri as jest.Mock;
const createLoginPendingUri = _createLoginPendingUri as jest.Mock;
const createLoginRejectedUri = _createLoginRejectedUri as jest.Mock;
const createSelectAccountPendingUri = _createSelectAccountPendingUri as jest.Mock;
const createSelectAccountRejectedUri = _createSelectAccountRejectedUri as jest.Mock;

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
    createConsentRejectedUri.mockReturnValue("createConsentRejectedUri");
    createLoginPendingUri.mockReturnValue("createLoginPendingUri");
    createLoginRejectedUri.mockReturnValue("createLoginRejectedUri");
    createSelectAccountPendingUri.mockReturnValue("createSelectAccountPendingUri");
    createSelectAccountRejectedUri.mockReturnValue("createSelectAccountRejectedUri");
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
        body: { redirectTo: "createSelectAccountRejectedUri" },
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
        body: { redirectTo: "createLoginRejectedUri" },
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
        body: { redirectTo: "createConsentRejectedUri" },
      });
    });
  });
});
