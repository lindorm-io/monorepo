import { AuthenticationMethod } from "@lindorm-io/common-types";
import { AuthorizationSession, BrowserSession } from "../../entity";
import { createTestAuthorizationSession, createTestBrowserSession } from "../../fixtures/entity";
import { verifyRequiredMethods } from "./verify-required-methods";

describe("verifyRequiredMethods", () => {
  let authorizationSession: AuthorizationSession;
  let browserSession: BrowserSession;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession();

    browserSession = createTestBrowserSession();
  });

  test("should return true when authorization session has no required methods", () => {
    authorizationSession.requestedLogin.methods = [];

    expect(verifyRequiredMethods(authorizationSession, browserSession)).toBe(true);
  });

  test("should return true when methods match", () => {
    authorizationSession.requestedLogin.methods = [AuthenticationMethod.BANK_ID_SE];
    browserSession.methods = [AuthenticationMethod.BANK_ID_SE];

    expect(verifyRequiredMethods(authorizationSession, browserSession)).toBe(true);
  });

  test("should return true with many methods", () => {
    authorizationSession.requestedLogin.methods = [AuthenticationMethod.BANK_ID_SE];
    browserSession.methods = Object.values(AuthenticationMethod);

    expect(verifyRequiredMethods(authorizationSession, browserSession)).toBe(true);
  });

  test("should return false when session has no methods", () => {
    authorizationSession.requestedLogin.methods = [AuthenticationMethod.BANK_ID_SE];
    browserSession.methods = [];

    expect(verifyRequiredMethods(authorizationSession, browserSession)).toBe(false);
  });

  test("should return false when session has missing methods", () => {
    authorizationSession.requestedLogin.methods = [AuthenticationMethod.DEVICE_LINK];
    browserSession.methods = [AuthenticationMethod.BANK_ID_SE];

    expect(verifyRequiredMethods(authorizationSession, browserSession)).toBe(false);
  });
});
