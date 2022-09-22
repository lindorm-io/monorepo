import MockDate from "mockdate";
import { AuthorizationSession, BrowserSession } from "../../entity";
import { AuthenticationMethod, PromptMode, SessionStatus } from "../../common";
import { createTestAuthorizationSession, createTestBrowserSession } from "../../fixtures/entity";
import { getAdjustedAccessLevel as _getAdjustedAccessLevel } from "../get-adjusted-access-level";
import { isLoginRequired } from "./is-login-required";
import { isLoginRequiredByMaxAge as _isLoginRequiredByMaxAge } from "./is-login-required-by-max-age";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../get-adjusted-access-level");
jest.mock("./is-login-required-by-max-age");

const getAdjustedAccessLevel = _getAdjustedAccessLevel as jest.Mock;
const isLoginRequiredByMaxAge = _isLoginRequiredByMaxAge as jest.Mock;

describe("isAuthenticationRequired", () => {
  let authorizationSession: AuthorizationSession;
  let browserSession: BrowserSession;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession({
      requestedLogin: {
        authenticationMethods: [AuthenticationMethod.EMAIL],
        identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
        levelOfAssurance: 1,
        levelHint: 0,
        methodHint: [],
      },
      promptModes: [PromptMode.NONE],
    });

    browserSession = createTestBrowserSession({
      acrValues: ["loa_1"],
      amrValues: [AuthenticationMethod.EMAIL],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 4,
    });

    getAdjustedAccessLevel.mockImplementation(() => 4);
    isLoginRequiredByMaxAge.mockImplementation(() => false);
  });

  test("should not require login when authentication is confirmed", () => {
    authorizationSession = createTestAuthorizationSession({
      status: {
        login: SessionStatus.CONFIRMED,
        consent: SessionStatus.PENDING,
      },
    });

    expect(isLoginRequired(authorizationSession, browserSession)).toBe(false);
  });

  test("should not require login when all requirements are satisfied", () => {
    expect(isLoginRequired(authorizationSession, browserSession)).toBe(false);
  });

  test("should require login when required by cookie data", () => {
    getAdjustedAccessLevel.mockImplementation(() => 1);

    browserSession = createTestBrowserSession({
      acrValues: [],
      amrValues: [],
      identityId: null,
      latestAuthentication: null,
      levelOfAssurance: 1,
    });

    expect(isLoginRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require login when required by identityId", () => {
    authorizationSession = createTestAuthorizationSession({
      requestedLogin: {
        identityId: "f78288ca-8753-420a-9db6-2775c4baf982",
        authenticationMethods: [],
        levelOfAssurance: 1,
        levelHint: 0,
        methodHint: [],
      },
      promptModes: [],
    });

    browserSession = createTestBrowserSession({
      acrValues: ["loa_1"],
      amrValues: [AuthenticationMethod.EMAIL],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 4,
    });

    expect(isLoginRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require login when required by country", () => {
    authorizationSession = createTestAuthorizationSession({
      requestedLogin: {
        authenticationMethods: [],
        identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
        levelHint: 0,
        levelOfAssurance: 1,
        methodHint: [],
      },
      country: "SE",
      promptModes: [],
    });

    browserSession = createTestBrowserSession({
      acrValues: ["loa_1"],
      amrValues: [AuthenticationMethod.EMAIL],
      country: "US",
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 4,
    });

    expect(isLoginRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require login when required by level of assurance", () => {
    getAdjustedAccessLevel.mockImplementation(() => 3);

    authorizationSession = createTestAuthorizationSession({
      requestedLogin: {
        authenticationMethods: [],
        identityId: null,
        levelHint: 0,
        levelOfAssurance: 4,
        methodHint: [],
      },
      idTokenHint: null,
      promptModes: [],
    });

    browserSession = createTestBrowserSession({
      acrValues: ["loa_1"],
      amrValues: [AuthenticationMethod.EMAIL],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 3,
    });

    expect(isLoginRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require login when required by authentication methods", () => {
    authorizationSession = createTestAuthorizationSession({
      requestedLogin: {
        authenticationMethods: [
          AuthenticationMethod.EMAIL,
          AuthenticationMethod.PHONE,
          AuthenticationMethod.PASSWORD,
        ],
        identityId: null,
        levelHint: 0,
        levelOfAssurance: 3,
        methodHint: [],
      },
      idTokenHint: null,
      promptModes: [],
    });

    browserSession = createTestBrowserSession({
      acrValues: ["loa_1"],
      amrValues: [AuthenticationMethod.EMAIL],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 3,
    });

    expect(isLoginRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require login when required by prompt", () => {
    authorizationSession = createTestAuthorizationSession({
      requestedLogin: {
        authenticationMethods: [],
        identityId: null,
        levelHint: 0,
        levelOfAssurance: 1,
        methodHint: [],
      },
      idTokenHint: null,
      promptModes: [PromptMode.LOGIN],
    });

    expect(isLoginRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require login when required by max age", () => {
    isLoginRequiredByMaxAge.mockImplementation(() => true);

    expect(isLoginRequired(authorizationSession, browserSession)).toBe(true);
  });
});
