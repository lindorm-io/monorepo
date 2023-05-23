import { OpenIdScope } from "@lindorm-io/common-types";
import { AuthorizationRequest, ClientSession } from "../../entity";
import { createTestAuthorizationRequest, createTestClientSession } from "../../fixtures/entity";
import { verifyRequiredScopes } from "./verify-required-scopes";

describe("verifyRequiredScopes", () => {
  let authorizationRequest: AuthorizationRequest;
  let clientSession: ClientSession;

  beforeEach(() => {
    authorizationRequest = createTestAuthorizationRequest();

    clientSession = createTestClientSession();
  });

  test("should return true when authorization session has no required scopes", () => {
    authorizationRequest.requestedConsent.scopes = [];

    expect(verifyRequiredScopes(authorizationRequest, clientSession)).toBe(true);
  });

  test("should return true when scopes match", () => {
    authorizationRequest.requestedConsent.scopes = [OpenIdScope.OPENID];
    clientSession.scopes = [OpenIdScope.OPENID];

    expect(verifyRequiredScopes(authorizationRequest, clientSession)).toBe(true);
  });

  test("should return true with many scopes", () => {
    authorizationRequest.requestedConsent.scopes = [OpenIdScope.OPENID];
    clientSession.scopes = [OpenIdScope.OPENID, OpenIdScope.OFFLINE_ACCESS, OpenIdScope.PROFILE];

    expect(verifyRequiredScopes(authorizationRequest, clientSession)).toBe(true);
  });

  test("should return false when session has no scopes", () => {
    authorizationRequest.requestedConsent.scopes = [OpenIdScope.OPENID];
    clientSession.scopes = [];

    expect(verifyRequiredScopes(authorizationRequest, clientSession)).toBe(false);
  });

  test("should return false when session has missing scopes", () => {
    authorizationRequest.requestedConsent.scopes = [OpenIdScope.EMAIL];
    clientSession.scopes = [OpenIdScope.OPENID];

    expect(verifyRequiredScopes(authorizationRequest, clientSession)).toBe(false);
  });
});
