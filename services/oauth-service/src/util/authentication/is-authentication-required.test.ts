import MockDate from "mockdate";
import { AuthorizationSession, BrowserSession } from "../../entity";
import { PromptMode, SessionStatus } from "../../common";
import { createTestAuthorizationSession, createTestBrowserSession } from "../../fixtures/entity";
import { isAuthenticationRequired } from "./is-authentication-required";
import { getAdjustedAccessLevel as _getAdjustedAccessLevel } from "../get-adjusted-access-level";
import { isAuthenticationRequiredByMaxAge as _isAuthenticationRequiredByMaxAge } from "./is-authentication-required-by-max-age";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../get-adjusted-access-level");
jest.mock("./is-authentication-required-by-max-age");

const getAdjustedAccessLevel = _getAdjustedAccessLevel as jest.Mock;
const isAuthenticationRequiredByMaxAge = _isAuthenticationRequiredByMaxAge as jest.Mock;

describe("isAuthenticationRequired", () => {
  let authorizationSession: AuthorizationSession;
  let browserSession: BrowserSession;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession({
      authenticationMethods: ["amr1"],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      levelOfAssurance: 1,
      promptModes: [PromptMode.NONE],
    });

    browserSession = createTestBrowserSession({
      acrValues: ["acr1"],
      amrValues: ["amr1"],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 4,
    });

    getAdjustedAccessLevel.mockImplementation(() => 4);
    isAuthenticationRequiredByMaxAge.mockImplementation(() => false);
  });

  test("should not require login when authentication is confirmed", () => {
    authorizationSession = createTestAuthorizationSession({
      authenticationStatus: SessionStatus.CONFIRMED,
    });

    expect(isAuthenticationRequired(authorizationSession, browserSession)).toBe(false);
  });

  test("should not require login when all requirements are satisfied", () => {
    expect(isAuthenticationRequired(authorizationSession, browserSession)).toBe(false);
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

    expect(isAuthenticationRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require login when required by identityId", () => {
    authorizationSession = createTestAuthorizationSession({
      identityId: "f78288ca-8753-420a-9db6-2775c4baf982",
      authenticationMethods: [],
      levelOfAssurance: 1,
      promptModes: [],
    });

    browserSession = createTestBrowserSession({
      acrValues: ["acr1"],
      amrValues: ["amr1"],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 4,
    });

    expect(isAuthenticationRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require login when required by country", () => {
    authorizationSession = createTestAuthorizationSession({
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      country: "SE",
      authenticationMethods: [],
      levelOfAssurance: 1,
      promptModes: [],
    });

    browserSession = createTestBrowserSession({
      acrValues: ["acr1"],
      amrValues: ["amr1"],
      country: "US",
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 4,
    });

    expect(isAuthenticationRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require login when required by level of assurance", () => {
    getAdjustedAccessLevel.mockImplementation(() => 3);

    authorizationSession = createTestAuthorizationSession({
      authenticationMethods: [],
      idTokenHint: null,
      identityId: null,
      levelOfAssurance: 4,
      promptModes: [],
    });

    browserSession = createTestBrowserSession({
      acrValues: ["acr1"],
      amrValues: ["amr1"],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 3,
    });

    expect(isAuthenticationRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require login when required by authentication methods", () => {
    authorizationSession = createTestAuthorizationSession({
      authenticationMethods: ["amr1", "amr2", "amr3"],
      idTokenHint: null,
      identityId: null,
      levelOfAssurance: 3,
      promptModes: [],
    });

    browserSession = createTestBrowserSession({
      acrValues: ["acr1"],
      amrValues: ["amr1"],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 3,
    });

    expect(isAuthenticationRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require login when required by prompt", () => {
    authorizationSession = createTestAuthorizationSession({
      authenticationMethods: [],
      idTokenHint: null,
      identityId: null,
      levelOfAssurance: 1,
      promptModes: [PromptMode.LOGIN],
    });

    expect(isAuthenticationRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require login when required by max age", () => {
    isAuthenticationRequiredByMaxAge.mockImplementation(() => true);

    expect(isAuthenticationRequired(authorizationSession, browserSession)).toBe(true);
  });
});
