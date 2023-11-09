import { AuthenticationFactor } from "@lindorm-io/common-enums";
import { AuthorizationSession, BrowserSession } from "../../entity";
import { createTestAuthorizationSession, createTestBrowserSession } from "../../fixtures/entity";
import { verifyRequiredFactors } from "./verify-required-factors";

describe("verifyRequiredFactors", () => {
  let authorizationSession: AuthorizationSession;
  let browserSession: BrowserSession;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession();

    browserSession = createTestBrowserSession();
  });

  test("should return true when authorization session has no required factors", () => {
    authorizationSession.requestedLogin.factors = [];

    expect(verifyRequiredFactors(authorizationSession, browserSession)).toBe(true);
  });

  test("should return true when factors match", () => {
    authorizationSession.requestedLogin.factors = [
      AuthenticationFactor.PHISHING_RESISTANT_HARDWARE,
    ];
    browserSession.factors = [AuthenticationFactor.PHISHING_RESISTANT_HARDWARE];

    expect(verifyRequiredFactors(authorizationSession, browserSession)).toBe(true);
  });

  test("should return true with many factors", () => {
    authorizationSession.requestedLogin.factors = [
      AuthenticationFactor.PHISHING_RESISTANT_HARDWARE,
    ];
    browserSession.factors = Object.values(AuthenticationFactor);

    expect(verifyRequiredFactors(authorizationSession, browserSession)).toBe(true);
  });

  test("should return false when session has no factors", () => {
    authorizationSession.requestedLogin.factors = [
      AuthenticationFactor.PHISHING_RESISTANT_HARDWARE,
    ];
    browserSession.factors = [];

    expect(verifyRequiredFactors(authorizationSession, browserSession)).toBe(false);
  });

  test("should return false when session has missing factors", () => {
    authorizationSession.requestedLogin.factors = [AuthenticationFactor.TWO_FACTOR];
    browserSession.factors = [AuthenticationFactor.ONE_FACTOR];

    expect(verifyRequiredFactors(authorizationSession, browserSession)).toBe(false);
  });
});
