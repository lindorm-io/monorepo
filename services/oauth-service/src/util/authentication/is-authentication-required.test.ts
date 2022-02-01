import MockDate from "mockdate";
import { AuthorizationSession, BrowserSession } from "../../entity";
import { PromptMode, SessionStatus } from "../../common";
import { getTestAuthorizationSession, getTestBrowserSession } from "../../test/entity";
import { isAuthenticationRequired } from "./is-authentication-required";
import { isAuthenticationRequiredByMaxAge as _isAuthenticationRequiredByMaxAge } from "./is-authentication-required-by-max-age";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("./is-authentication-required-by-max-age");

const isAuthenticationRequiredByMaxAge = _isAuthenticationRequiredByMaxAge as jest.Mock;

describe("isAuthenticationRequired", () => {
  let authorizationSession: AuthorizationSession;
  let browserSession: BrowserSession;

  beforeEach(() => {
    authorizationSession = getTestAuthorizationSession({
      authenticationMethods: ["amr1"],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      levelOfAssurance: 1,
      promptModes: [PromptMode.NONE],
    });

    browserSession = getTestBrowserSession({
      acrValues: ["acr1"],
      amrValues: ["amr1"],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 4,
    });

    isAuthenticationRequiredByMaxAge.mockImplementation(() => false);
  });

  test("should not require login when authentication is confirmed", () => {
    authorizationSession = getTestAuthorizationSession({
      authenticationStatus: SessionStatus.CONFIRMED,
    });

    expect(isAuthenticationRequired(authorizationSession, browserSession)).toBe(false);
  });

  test("should not require login when all requirements are satisfied", () => {
    expect(isAuthenticationRequired(authorizationSession, browserSession)).toBe(false);
  });

  test("should require login when required by cookie data", () => {
    browserSession = getTestBrowserSession({
      acrValues: [],
      amrValues: [],
      identityId: null,
      latestAuthentication: null,
      levelOfAssurance: 1,
    });

    expect(isAuthenticationRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require login when required by identityId", () => {
    authorizationSession = getTestAuthorizationSession({
      identityId: "f78288ca-8753-420a-9db6-2775c4baf982",
      authenticationMethods: [],
      levelOfAssurance: 1,
      promptModes: [],
    });

    browserSession = getTestBrowserSession({
      acrValues: ["acr1"],
      amrValues: ["amr1"],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 4,
    });

    expect(isAuthenticationRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require login when required by country", () => {
    authorizationSession = getTestAuthorizationSession({
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      country: "SE",
      authenticationMethods: [],
      levelOfAssurance: 1,
      promptModes: [],
    });

    browserSession = getTestBrowserSession({
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
    authorizationSession = getTestAuthorizationSession({
      authenticationMethods: [],
      idTokenHint: null,
      identityId: null,
      levelOfAssurance: 4,
      promptModes: [],
    });
    browserSession = getTestBrowserSession({
      acrValues: ["acr1"],
      amrValues: ["amr1"],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 3,
    });

    expect(isAuthenticationRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require login when required by authentication methods", () => {
    authorizationSession = getTestAuthorizationSession({
      authenticationMethods: ["amr1", "amr2", "amr3"],
      idTokenHint: null,
      identityId: null,
      levelOfAssurance: 3,
      promptModes: [],
    });
    browserSession = getTestBrowserSession({
      acrValues: ["acr1"],
      amrValues: ["amr1"],
      identityId: "3bca3d94-d2c6-478a-aa74-0796e1d94b9c",
      latestAuthentication: new Date("2021-01-01T05:00:00.000Z"),
      levelOfAssurance: 3,
    });

    expect(isAuthenticationRequired(authorizationSession, browserSession)).toBe(true);
  });

  test("should require login when required by prompt", () => {
    authorizationSession = getTestAuthorizationSession({
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
