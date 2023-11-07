import { AuthenticationStrategy } from "@lindorm-io/common-types";
import { AuthorizationSession, BrowserSession } from "../../entity";
import { createTestAuthorizationSession, createTestBrowserSession } from "../../fixtures/entity";
import { verifyRequiredStrategies } from "./verify-required-strategies";

describe("verifyRequiredStrategies", () => {
  let authorizationSession: AuthorizationSession;
  let browserSession: BrowserSession;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession();

    browserSession = createTestBrowserSession();
  });

  test("should return true when authorization session has no required strategies", () => {
    authorizationSession.requestedLogin.strategies = [];

    expect(verifyRequiredStrategies(authorizationSession, browserSession)).toBe(true);
  });

  test("should return true when strategies match", () => {
    authorizationSession.requestedLogin.strategies = [AuthenticationStrategy.BANK_ID_SE];
    browserSession.strategies = [AuthenticationStrategy.BANK_ID_SE];

    expect(verifyRequiredStrategies(authorizationSession, browserSession)).toBe(true);
  });

  test("should return true with many strategies", () => {
    authorizationSession.requestedLogin.strategies = [AuthenticationStrategy.BANK_ID_SE];
    browserSession.strategies = Object.values(AuthenticationStrategy);

    expect(verifyRequiredStrategies(authorizationSession, browserSession)).toBe(true);
  });

  test("should return false when session has no strategies", () => {
    authorizationSession.requestedLogin.strategies = [AuthenticationStrategy.BANK_ID_SE];
    browserSession.strategies = [];

    expect(verifyRequiredStrategies(authorizationSession, browserSession)).toBe(false);
  });

  test("should return false when session has missing strategies", () => {
    authorizationSession.requestedLogin.strategies = [AuthenticationStrategy.DEVICE_CHALLENGE];
    browserSession.strategies = [AuthenticationStrategy.BANK_ID_SE];

    expect(verifyRequiredStrategies(authorizationSession, browserSession)).toBe(false);
  });
});
