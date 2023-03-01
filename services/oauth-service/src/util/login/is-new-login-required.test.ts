import { AccessSession, AuthorizationSession, BrowserSession, RefreshSession } from "../../entity";
import { getAdjustedAccessLevel as _getAdjustedAccessLevel } from "../get-adjusted-access-level";
import { isBrowserSessionExpired as _isBrowserSessionExpired } from "./is-browser-session-expired";
import { isLoginRequiredByMaxAge as _isLoginRequiredByMaxAge } from "./is-login-required-by-max-age";
import { isNewLoginRequired } from "./is-new-login-required";
import { randomUUID } from "crypto";
import {
  createTestAccessSession,
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestRefreshSession,
} from "../../fixtures/entity";
import { AuthenticationMethod } from "@lindorm-io/common-types";

jest.mock("../get-adjusted-access-level");
jest.mock("./is-browser-session-expired");
jest.mock("./is-login-required-by-max-age");

const getAdjustedAccessLevel = _getAdjustedAccessLevel as jest.Mock;
const isBrowserSessionExpired = _isBrowserSessionExpired as jest.Mock;
const isLoginRequiredByMaxAge = _isLoginRequiredByMaxAge as jest.Mock;

describe("isNewLoginRequired", () => {
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
        requiredMethods: [AuthenticationMethod.EMAIL],
      },
      promptModes: [],
    });

    accessSession = createTestAccessSession({
      methods: [AuthenticationMethod.EMAIL],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 4,
    });

    browserSession = createTestBrowserSession({
      methods: [AuthenticationMethod.EMAIL],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 4,
    });

    refreshSession = createTestRefreshSession({
      methods: [AuthenticationMethod.EMAIL],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 4,
    });

    getAdjustedAccessLevel.mockImplementation(() => 4);
    isBrowserSessionExpired.mockImplementation(() => false);
    isLoginRequiredByMaxAge.mockImplementation(() => false);
  });

  afterEach(jest.resetAllMocks);

  test("should not require for access session", () => {
    expect(isNewLoginRequired(authorizationSession, accessSession)).toBe(false);
  });

  test("should not require for browser session", () => {
    expect(isNewLoginRequired(authorizationSession, browserSession)).toBe(false);
  });

  test("should not require for refresh session", () => {
    expect(isNewLoginRequired(authorizationSession, refreshSession)).toBe(false);
  });

  test("should require when identity is different", () => {
    browserSession = createTestBrowserSession({
      methods: [AuthenticationMethod.EMAIL],
      identityId: randomUUID(),
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 4,
    });

    expect(isNewLoginRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require when minimum level is higher than adjusted", () => {
    getAdjustedAccessLevel.mockImplementation(() => 0);

    expect(isNewLoginRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require when required level is higher than adjusted", () => {
    getAdjustedAccessLevel.mockImplementation(() => 2);

    expect(isNewLoginRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require when methods are different", () => {
    browserSession = createTestBrowserSession({
      methods: [AuthenticationMethod.PASSWORD],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 4,
    });

    expect(isNewLoginRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require when browser session is expired", () => {
    isBrowserSessionExpired.mockImplementation(() => true);

    expect(isNewLoginRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require when max age has been exceeded", () => {
    isLoginRequiredByMaxAge.mockImplementation(() => true);

    expect(isNewLoginRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should ignore browser session specific method", () => {
    isBrowserSessionExpired.mockImplementation(() => true);

    expect(isNewLoginRequired(authorizationSession, accessSession)).toBe(false);
  });
});
