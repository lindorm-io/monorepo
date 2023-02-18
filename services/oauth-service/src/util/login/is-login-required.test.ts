import MockDate from "mockdate";
import { AccessSession, AuthorizationSession, BrowserSession, RefreshSession } from "../../entity";
import { isLoginRequired } from "./is-login-required";
import { isNewLoginRequired as _isNewLoginRequired } from "./is-new-login-required";
import {
  createTestAccessSession,
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestRefreshSession,
} from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("./is-new-login-required");

const isNewLoginRequired = _isNewLoginRequired as jest.Mock;

describe("isLoginRequired", () => {
  let authorizationSession: AuthorizationSession;
  let accessSession: AccessSession;
  let browserSession: BrowserSession;
  let refreshSession: RefreshSession;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession({
      requestedLogin: {
        identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
        minimumLevel: 1,
        recommendedLevel: 2,
        recommendedMethods: [],
        requiredLevel: 3,
        requiredMethods: ["email"],
      },
      promptModes: [],
    });

    accessSession = createTestAccessSession({
      methods: ["email"],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 4,
    });

    browserSession = createTestBrowserSession({
      methods: ["email"],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 4,
    });

    refreshSession = createTestRefreshSession({
      methods: ["email"],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 4,
    });

    isNewLoginRequired.mockImplementation(() => false);
  });

  afterEach(jest.resetAllMocks);

  test("should not require", () => {
    expect(
      isLoginRequired(authorizationSession, browserSession, accessSession, refreshSession),
    ).toBe(false);
  });

  test("should not require on confirmed", () => {
    authorizationSession.status.login = "confirmed";

    expect(isLoginRequired(authorizationSession)).toBe(false);
  });

  test("should not require on confirmed", () => {
    authorizationSession.status.login = "verified";

    expect(isLoginRequired(authorizationSession)).toBe(false);
  });

  test("should require on prompt", () => {
    authorizationSession.promptModes.push("login");

    expect(isLoginRequired(authorizationSession)).toBe(true);
  });

  test("should require on sessions", () => {
    isNewLoginRequired.mockImplementation(() => true);

    expect(isLoginRequired(authorizationSession)).toBe(true);
  });

  test("should require on sso not enabled", () => {
    isNewLoginRequired
      .mockImplementationOnce(() => true)
      .mockImplementationOnce(() => false)
      .mockImplementationOnce(() => true);

    browserSession.sso = false;

    expect(isLoginRequired(authorizationSession, browserSession)).toBe(true);
  });
});
