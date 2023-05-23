import { AuthorizationRequest, BrowserSession } from "../../entity";
import { createTestAuthorizationRequest, createTestBrowserSession } from "../../fixtures/entity";
import { getAdjustedAccessLevel as _getAdjustedAccessLevel } from "../get-adjusted-access-level";
import { verifyAccessLevel } from "./verify-access-level";

jest.mock("../get-adjusted-access-level");

const getAdjustedAccessLevel = _getAdjustedAccessLevel as jest.Mock;

describe("verifyAccessLevel", () => {
  let authorizationRequest: AuthorizationRequest;
  let browserSession: BrowserSession;

  beforeEach(() => {
    authorizationRequest = createTestAuthorizationRequest();
    browserSession = createTestBrowserSession();

    getAdjustedAccessLevel.mockReturnValue(4);
  });

  test("should return true when adjusted accessLevel is same or higher", () => {
    expect(verifyAccessLevel(authorizationRequest, browserSession)).toBe(true);
  });

  test("should return false when session has 0 access level", () => {
    browserSession = createTestBrowserSession({
      levelOfAssurance: 0,
    });

    expect(verifyAccessLevel(authorizationRequest, browserSession)).toBe(false);
  });

  test("should return false when adjusted accessLevel lower than required level", () => {
    getAdjustedAccessLevel.mockReturnValue(2);

    expect(verifyAccessLevel(authorizationRequest, browserSession)).toBe(false);
  });

  test("should return false when adjusted accessLevel lower than minimum level", () => {
    getAdjustedAccessLevel.mockReturnValue(1);

    expect(verifyAccessLevel(authorizationRequest, browserSession)).toBe(false);
  });
});
