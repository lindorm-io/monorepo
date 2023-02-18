import { AccessSession, AuthorizationSession, RefreshSession } from "../../entity";
import { isNewConsentRequired } from "./is-new-consent-required";
import {
  createTestAccessSession,
  createTestAuthorizationSession,
  createTestRefreshSession,
} from "../../fixtures/entity";

describe("isNewConsentRequired", () => {
  let authorizationSession: AuthorizationSession;
  let accessSession: AccessSession;
  let refreshSession: RefreshSession;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession({
      requestedConsent: {
        audiences: ["689fe3c9-ac1a-4025-a328-218ada7a4922"],
        scopes: ["openid"],
      },
      promptModes: [],
    });

    accessSession = createTestAccessSession({
      audiences: ["689fe3c9-ac1a-4025-a328-218ada7a4922"],
      scopes: ["openid", "email", "profile"],
    });

    refreshSession = createTestRefreshSession({
      audiences: ["689fe3c9-ac1a-4025-a328-218ada7a4922"],
      scopes: ["openid", "email", "profile"],
    });
  });

  test("should not require for access session", () => {
    expect(isNewConsentRequired(authorizationSession, accessSession)).toBe(false);
  });

  test("should not require for refresh session", () => {
    expect(isNewConsentRequired(authorizationSession, refreshSession)).toBe(false);
  });

  test("should require for empty audience", () => {
    accessSession.audiences = [];

    expect(isNewConsentRequired(authorizationSession, accessSession)).toBe(true);
  });

  test("should require for empty audience", () => {
    accessSession.scopes = [];

    expect(isNewConsentRequired(authorizationSession, accessSession)).toBe(true);
  });

  test("should require for differing audience", () => {
    authorizationSession.requestedConsent.audiences = ["678d1aec-f0ae-49e1-bd47-120006f02485"];

    expect(isNewConsentRequired(authorizationSession, accessSession)).toBe(true);
  });

  test("should require for differing scopes", () => {
    authorizationSession.requestedConsent.scopes = ["openid", "public"];

    expect(isNewConsentRequired(authorizationSession, accessSession)).toBe(true);
  });
});
