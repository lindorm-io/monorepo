import { AuthorizationSession, BrowserSession, ClientSession } from "../../entity";
import { isConsentRequired } from "./is-consent-required";
import { isNewConsentRequired as _isNewConsentRequired } from "./is-new-consent-required";
import { OpenIdPromptMode, OpenIdScope, SessionStatus } from "@lindorm-io/common-types";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClientSession,
} from "../../fixtures/entity";

jest.mock("./is-new-consent-required");

const isNewConsentRequired = _isNewConsentRequired as jest.Mock;

describe("isConsentRequired", () => {
  let authorizationSession: AuthorizationSession;
  let browserSession: BrowserSession;
  let clientSession: ClientSession;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession({
      requestedConsent: {
        audiences: ["689fe3c9-ac1a-4025-a328-218ada7a4922"],
        scopes: [OpenIdScope.OPENID],
      },
      promptModes: [],
    });

    browserSession = createTestBrowserSession();

    clientSession = createTestClientSession({
      audiences: ["689fe3c9-ac1a-4025-a328-218ada7a4922"],
      scopes: [OpenIdScope.OPENID, OpenIdScope.EMAIL, OpenIdScope.PROFILE],
    });

    isNewConsentRequired.mockImplementation(() => false);
  });

  afterEach(jest.resetAllMocks);

  test("should not require", () => {
    expect(isConsentRequired(authorizationSession, browserSession, clientSession)).toBe(false);
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

  test("should require on client session", () => {
    isNewConsentRequired.mockImplementation(() => true);

    expect(isConsentRequired(authorizationSession, browserSession, clientSession)).toBe(true);
  });
});
