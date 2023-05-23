import { AuthorizationRequest, BrowserSession } from "../../entity";
import { createTestAuthorizationRequest, createTestBrowserSession } from "../../fixtures/entity";
import { verifyIdentityId } from "./verify-identity-id";

describe("verifyIdentityId", () => {
  let authorizationRequest: AuthorizationRequest;
  let browserSession: BrowserSession;

  beforeEach(() => {
    authorizationRequest = createTestAuthorizationRequest();

    browserSession = createTestBrowserSession({
      identityId: authorizationRequest.requestedLogin.identityId!,
    });
  });

  test("should return true when identityId is the same", () => {
    expect(verifyIdentityId(authorizationRequest, browserSession)).toBe(true);
  });

  test("should return false when identityId is not the same", () => {
    authorizationRequest.requestedLogin.identityId = "wrong-identity-id";

    expect(verifyIdentityId(authorizationRequest, browserSession)).toBe(false);
  });
});
