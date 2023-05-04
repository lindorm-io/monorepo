import { AuthorizationSession, BrowserSession } from "../../entity";
import { createTestAuthorizationSession, createTestBrowserSession } from "../../fixtures/entity";
import { getAdjustedAccessLevel as _getAdjustedAccessLevel } from "../get-adjusted-access-level";
import { verifyAccessLevel } from "./verify-access-level";

jest.mock("../get-adjusted-access-level");

const getAdjustedAccessLevel = _getAdjustedAccessLevel as jest.Mock;

describe("verifyAccessLevel", () => {
  let authorizationSession: AuthorizationSession;
  let browserSession: BrowserSession;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession();
    browserSession = createTestBrowserSession();

    getAdjustedAccessLevel.mockReturnValue(4);
  });

  test("should return true when adjusted accessLevel is same or higher", () => {
    expect(verifyAccessLevel(authorizationSession, browserSession)).toBe(true);
  });

  test("should return false when session has 0 access level", () => {
    browserSession = createTestBrowserSession({
      levelOfAssurance: 0,
    });

    expect(verifyAccessLevel(authorizationSession, browserSession)).toBe(false);
  });

  test("should return false when adjusted accessLevel lower than required level", () => {
    getAdjustedAccessLevel.mockReturnValue(2);

    expect(verifyAccessLevel(authorizationSession, browserSession)).toBe(false);
  });

  test("should return false when adjusted accessLevel lower than minimum level", () => {
    getAdjustedAccessLevel.mockReturnValue(1);

    expect(verifyAccessLevel(authorizationSession, browserSession)).toBe(false);
  });
});
