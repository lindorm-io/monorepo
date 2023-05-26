import { createMockLogger } from "@lindorm-io/winston";
import { AuthorizationSession, BrowserSession } from "../../entity";
import { createTestAuthorizationSession, createTestBrowserSession } from "../../fixtures/entity";
import {
  verifyAccessLevel as _verifyAccessLevel,
  verifyIdentityId as _verifyIdentityId,
  verifyMaxAge as _verifyMaxAge,
  verifyRequiredMethods as _verifyRequiredMethods,
  verifySessionExpiry as _verifySessionExpiry,
} from "../../util";
import { verifyLoginPrerequisites } from "./verify-login-prerequisites";

jest.mock("../../util");

const verifyAccessLevel = _verifyAccessLevel as jest.Mock;
const verifyIdentityId = _verifyIdentityId as jest.Mock;
const verifyMaxAge = _verifyMaxAge as jest.Mock;
const verifyRequiredMethods = _verifyRequiredMethods as jest.Mock;
const verifySessionExpiry = _verifySessionExpiry as jest.Mock;

describe("verifyLoginPrerequisites", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;
  let browserSession: BrowserSession;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
    };

    authorizationSession = createTestAuthorizationSession();
    browserSession = createTestBrowserSession();

    verifyAccessLevel.mockReturnValue(true);
    verifyIdentityId.mockReturnValue(true);
    verifyMaxAge.mockReturnValue(true);
    verifyRequiredMethods.mockReturnValue(true);
    verifySessionExpiry.mockReturnValue(true);
  });

  test("should return true", () => {
    expect(verifyLoginPrerequisites(ctx, authorizationSession, browserSession)).toBe(true);
  });

  test("should return false when session is missing", () => {
    expect(verifyLoginPrerequisites(ctx, authorizationSession)).toBe(false);
  });

  test("should return false on identity id returning false", () => {
    verifyIdentityId.mockReturnValue(false);

    expect(verifyLoginPrerequisites(ctx, authorizationSession, browserSession)).toBe(false);
  });

  test("should return false on access level returning false", () => {
    verifyAccessLevel.mockReturnValue(false);

    expect(verifyLoginPrerequisites(ctx, authorizationSession, browserSession)).toBe(false);
  });

  test("should return false on required methods returning false", () => {
    verifyRequiredMethods.mockReturnValue(false);

    expect(verifyLoginPrerequisites(ctx, authorizationSession, browserSession)).toBe(false);
  });

  test("should return false on session expiry returning false", () => {
    verifySessionExpiry.mockReturnValue(false);

    expect(verifyLoginPrerequisites(ctx, authorizationSession, browserSession)).toBe(false);
  });

  test("should return false on max age returning false", () => {
    verifyMaxAge.mockReturnValue(false);

    expect(verifyLoginPrerequisites(ctx, authorizationSession, browserSession)).toBe(false);
  });
});
