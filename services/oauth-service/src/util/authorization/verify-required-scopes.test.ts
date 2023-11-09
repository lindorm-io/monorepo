import { Scope } from "@lindorm-io/common-enums";
import { AuthorizationSession, ClientSession } from "../../entity";
import { createTestAuthorizationSession, createTestClientSession } from "../../fixtures/entity";
import { verifyRequiredScopes } from "./verify-required-scopes";

describe("verifyRequiredScopes", () => {
  let authorizationSession: AuthorizationSession;
  let clientSession: ClientSession;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession();

    clientSession = createTestClientSession();
  });

  test("should return true when authorization session has no required scopes", () => {
    authorizationSession.requestedConsent.scopes = [];

    expect(verifyRequiredScopes(authorizationSession, clientSession)).toBe(true);
  });

  test("should return true when scopes match", () => {
    authorizationSession.requestedConsent.scopes = [Scope.OPENID];
    clientSession.scopes = [Scope.OPENID];

    expect(verifyRequiredScopes(authorizationSession, clientSession)).toBe(true);
  });

  test("should return true with many scopes", () => {
    authorizationSession.requestedConsent.scopes = [Scope.OPENID];
    clientSession.scopes = [Scope.OPENID, Scope.OFFLINE_ACCESS, Scope.PROFILE];

    expect(verifyRequiredScopes(authorizationSession, clientSession)).toBe(true);
  });

  test("should return false when session has no scopes", () => {
    authorizationSession.requestedConsent.scopes = [Scope.OPENID];
    clientSession.scopes = [];

    expect(verifyRequiredScopes(authorizationSession, clientSession)).toBe(false);
  });

  test("should return false when session has missing scopes", () => {
    authorizationSession.requestedConsent.scopes = [Scope.EMAIL];
    clientSession.scopes = [Scope.OPENID];

    expect(verifyRequiredScopes(authorizationSession, clientSession)).toBe(false);
  });
});
