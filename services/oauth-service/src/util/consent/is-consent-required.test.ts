import { AccessSession, AuthorizationSession, BrowserSession, RefreshSession } from "../../entity";
import { isConsentRequired } from "./is-consent-required";
import { isNewConsentRequired as _isNewConsentRequired } from "./is-new-consent-required";
import {
  createTestAccessSession,
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestRefreshSession,
} from "../../fixtures/entity";
import { OpenIdPromptMode, OpenIdScope, SessionStatus } from "@lindorm-io/common-types";

jest.mock("./is-new-consent-required");

const isNewConsentRequired = _isNewConsentRequired as jest.Mock;

describe("isConsentRequired", () => {
  let authorizationSession: AuthorizationSession;
  let accessSession: AccessSession;
  let browserSession: BrowserSession;
  let refreshSession: RefreshSession;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession({
      requestedConsent: {
        audiences: ["689fe3c9-ac1a-4025-a328-218ada7a4922"],
        scopes: [OpenIdScope.OPENID],
      },
      promptModes: [],
    });

    accessSession = createTestAccessSession({
      audiences: ["689fe3c9-ac1a-4025-a328-218ada7a4922"],
      scopes: [OpenIdScope.OPENID, OpenIdScope.EMAIL, OpenIdScope.PROFILE],
    });

    browserSession = createTestBrowserSession();

    refreshSession = createTestRefreshSession({
      audiences: ["689fe3c9-ac1a-4025-a328-218ada7a4922"],
      scopes: [OpenIdScope.OPENID, OpenIdScope.EMAIL, OpenIdScope.PROFILE],
    });

    isNewConsentRequired.mockImplementation(() => false);
  });

  afterEach(jest.resetAllMocks);

  test("should not require", () => {
    expect(
      isConsentRequired(authorizationSession, browserSession, accessSession, refreshSession),
    ).toBe(false);
  });

  test("should not require on confirmed", () => {
    authorizationSession.status.consent = SessionStatus.CONFIRMED;

    expect(isConsentRequired(authorizationSession)).toBe(false);
  });

  test("should not require on confirmed", () => {
    authorizationSession.status.consent = SessionStatus.VERIFIED;

    expect(isConsentRequired(authorizationSession)).toBe(false);
  });

  test("should require on prompt", () => {
    authorizationSession.promptModes.push(OpenIdPromptMode.CONSENT);

    expect(isConsentRequired(authorizationSession)).toBe(true);
  });

  test("should require on missing browser session", () => {
    expect(isConsentRequired(authorizationSession)).toBe(true);
  });

  test("should require on access session", () => {
    isNewConsentRequired.mockImplementation(() => true);

    expect(isConsentRequired(authorizationSession, browserSession, accessSession)).toBe(true);
  });

  test("should require on refresh session", () => {
    isNewConsentRequired.mockImplementation(() => true);

    expect(isConsentRequired(authorizationSession, browserSession, undefined, refreshSession)).toBe(
      true,
    );
  });
});
