import { AuthenticationMethod } from "@lindorm-io/common-types";
import { AuthorizationRequest, BrowserSession } from "../../entity";
import { createTestAuthorizationRequest, createTestBrowserSession } from "../../fixtures/entity";
import { verifyRequiredMethods } from "./verify-required-methods";

describe("verifyRequiredMethods", () => {
  let authorizationRequest: AuthorizationRequest;
  let browserSession: BrowserSession;

  beforeEach(() => {
    authorizationRequest = createTestAuthorizationRequest();

    browserSession = createTestBrowserSession();
  });

  test("should return true when authorization session has no required methods", () => {
    authorizationRequest.requestedLogin.requiredMethods = [];

    expect(verifyRequiredMethods(authorizationRequest, browserSession)).toBe(true);
  });

  test("should return true when methods match", () => {
    authorizationRequest.requestedLogin.requiredMethods = [AuthenticationMethod.BANK_ID_SE];
    browserSession.methods = [AuthenticationMethod.BANK_ID_SE];

    expect(verifyRequiredMethods(authorizationRequest, browserSession)).toBe(true);
  });

  test("should return true with many methods", () => {
    authorizationRequest.requestedLogin.requiredMethods = [AuthenticationMethod.BANK_ID_SE];
    browserSession.methods = Object.values(AuthenticationMethod);

    expect(verifyRequiredMethods(authorizationRequest, browserSession)).toBe(true);
  });

  test("should return false when session has no methods", () => {
    authorizationRequest.requestedLogin.requiredMethods = [AuthenticationMethod.BANK_ID_SE];
    browserSession.methods = [];

    expect(verifyRequiredMethods(authorizationRequest, browserSession)).toBe(false);
  });

  test("should return false when session has missing methods", () => {
    authorizationRequest.requestedLogin.requiredMethods = [AuthenticationMethod.DEVICE_LINK];
    browserSession.methods = [AuthenticationMethod.BANK_ID_SE];

    expect(verifyRequiredMethods(authorizationRequest, browserSession)).toBe(false);
  });
});
