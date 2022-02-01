import { AuthorizationSession, BrowserSession, ConsentSession } from "../../entity";
import {
  getTestAuthorizationSession,
  getTestBrowserSession,
  getTestConsentSession,
} from "../../test/entity";
import { isConsentRequired } from "./is-consent-required";
import { SessionStatus } from "../../common";

describe("isConsentRequired", () => {
  let authorizationSession: AuthorizationSession;
  let browserSession: BrowserSession;
  let consentSession: ConsentSession;

  beforeEach(() => {
    authorizationSession = getTestAuthorizationSession({
      clientId: "client1",
      scopes: ["scope1", "scope2"],
    });

    browserSession = getTestBrowserSession({
      id: "0d8143ae-b105-4989-9118-0663aa4d58f8",
    });

    consentSession = getTestConsentSession({
      identityId: "account1",
      audiences: ["client1", "client2"],
      scopes: ["scope1", "scope2", "scope3"],
      sessions: ["0d8143ae-b105-4989-9118-0663aa4d58f8"],
    });
  });

  test("should not require consent when consent is confirmed", () => {
    authorizationSession = getTestAuthorizationSession({
      consentStatus: SessionStatus.CONFIRMED,
    });

    expect(isConsentRequired(authorizationSession, browserSession, consentSession)).toBe(false);
  });

  test("should not require consent when all requirements are satisfied", () => {
    expect(isConsentRequired(authorizationSession, browserSession, consentSession)).toBe(false);
  });

  test("should require consent when required by browser session", () => {
    consentSession = getTestConsentSession({
      identityId: null,
      audiences: [],
      scopes: [],
    });

    expect(isConsentRequired(authorizationSession, browserSession, consentSession)).toBe(true);
  });

  test("should require consent when required by audience", () => {
    authorizationSession = getTestAuthorizationSession({
      clientId: "client3",
    });

    expect(isConsentRequired(authorizationSession, browserSession, consentSession)).toBe(true);
  });

  test("should require consent when required by scope", () => {
    authorizationSession = getTestAuthorizationSession({
      clientId: "client1",
      scopes: ["scope4"],
    });

    expect(isConsentRequired(authorizationSession, browserSession, consentSession)).toBe(true);
  });
});
