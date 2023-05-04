import { AuthorizationSession, BrowserSession } from "../../entity";
import { createTestAuthorizationSession, createTestBrowserSession } from "../../fixtures/entity";
import { verifyIdentityId } from "./verify-identity-id";

describe("verifyIdentityId", () => {
  let authorizationSession: AuthorizationSession;
  let browserSession: BrowserSession;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession();

    browserSession = createTestBrowserSession({
      identityId: authorizationSession.requestedLogin.identityId!,
    });
  });

  test("should return true when identityId is the same", () => {
    expect(verifyIdentityId(authorizationSession, browserSession)).toBe(true);
  });

  test("should return false when identityId is not the same", () => {
    authorizationSession.requestedLogin.identityId = "wrong-identity-id";

    expect(verifyIdentityId(authorizationSession, browserSession)).toBe(false);
  });
});
