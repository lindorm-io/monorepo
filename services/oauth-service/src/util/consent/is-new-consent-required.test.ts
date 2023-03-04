import { AuthorizationSession, ClientSession } from "../../entity";
import { LindormScope, OpenIdScope } from "@lindorm-io/common-types";
import { createTestAuthorizationSession, createTestClientSession } from "../../fixtures/entity";
import { isNewConsentRequired } from "./is-new-consent-required";

describe("isNewConsentRequired", () => {
  let authorizationSession: AuthorizationSession;
  let clientSession: ClientSession;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession({
      requestedConsent: {
        audiences: ["689fe3c9-ac1a-4025-a328-218ada7a4922"],
        scopes: [OpenIdScope.OPENID],
      },
      promptModes: [],
    });

    clientSession = createTestClientSession({
      audiences: ["689fe3c9-ac1a-4025-a328-218ada7a4922"],
      scopes: [OpenIdScope.OPENID, OpenIdScope.EMAIL, OpenIdScope.PROFILE],
    });
  });

  test("should not require for client session", () => {
    expect(isNewConsentRequired(authorizationSession, clientSession)).toBe(false);
  });

  test("should require for empty audience", () => {
    clientSession.audiences = [];

    expect(isNewConsentRequired(authorizationSession, clientSession)).toBe(true);
  });

  test("should require for empty audience", () => {
    clientSession.scopes = [];

    expect(isNewConsentRequired(authorizationSession, clientSession)).toBe(true);
  });

  test("should require for differing audience", () => {
    authorizationSession.requestedConsent.audiences = ["678d1aec-f0ae-49e1-bd47-120006f02485"];

    expect(isNewConsentRequired(authorizationSession, clientSession)).toBe(true);
  });

  test("should require for differing scopes", () => {
    authorizationSession.requestedConsent.scopes = [OpenIdScope.OPENID, LindormScope.PUBLIC];

    expect(isNewConsentRequired(authorizationSession, clientSession)).toBe(true);
  });
});
