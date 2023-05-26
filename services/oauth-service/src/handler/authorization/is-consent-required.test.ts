import { SessionStatus } from "@lindorm-io/common-types";
import { createMockLogger } from "@lindorm-io/winston";
import { AuthorizationSession, BrowserSession, ClientSession } from "../../entity";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClientSession,
} from "../../fixtures/entity";
import {
  verifyPromptMode as _verifyPromptMode,
  verifyRequiredAudiences as _verifyRequiredAudiences,
  verifyRequiredScopes as _verifyRequiredScopes,
} from "../../util";
import { isConsentRequired } from "./is-consent-required";

jest.mock("../../util");

const verifyPromptMode = _verifyPromptMode as jest.Mock;
const verifyRequiredAudiences = _verifyRequiredAudiences as jest.Mock;
const verifyRequiredScopes = _verifyRequiredScopes as jest.Mock;

describe("isConsentRequired", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;
  let browserSession: BrowserSession;
  let clientSession: ClientSession;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
    };

    authorizationSession = createTestAuthorizationSession();
    browserSession = createTestBrowserSession();
    clientSession = createTestClientSession();

    verifyPromptMode.mockReturnValue(true);
    verifyRequiredAudiences.mockReturnValue(true);
    verifyRequiredScopes.mockReturnValue(true);
  });

  test("should return false", () => {
    expect(isConsentRequired(ctx, authorizationSession, browserSession, clientSession)).toBe(false);
  });

  test("should return false when session status is confirmed", () => {
    authorizationSession.status.consent = SessionStatus.CONFIRMED;

    expect(isConsentRequired(ctx, authorizationSession, browserSession, clientSession)).toBe(false);
  });

  test("should return false when session status is verified", () => {
    authorizationSession.status.consent = SessionStatus.VERIFIED;

    expect(isConsentRequired(ctx, authorizationSession, browserSession, clientSession)).toBe(false);
  });

  test("should return true when prompt mode returns false", () => {
    verifyPromptMode.mockReturnValue(false);

    expect(isConsentRequired(ctx, authorizationSession, browserSession, clientSession)).toBe(true);
  });

  test("should return true when browser session is missing", () => {
    expect(isConsentRequired(ctx, authorizationSession, undefined, clientSession)).toBe(true);
  });

  test("should return true when client session is missing", () => {
    expect(isConsentRequired(ctx, authorizationSession, browserSession, undefined)).toBe(true);
  });

  test("should return true when required audiences returns false", () => {
    verifyRequiredAudiences.mockReturnValue(false);

    expect(isConsentRequired(ctx, authorizationSession, browserSession, clientSession)).toBe(true);
  });

  test("should return true when required scopes returns false", () => {
    verifyRequiredScopes.mockReturnValue(false);

    expect(isConsentRequired(ctx, authorizationSession, browserSession, clientSession)).toBe(true);
  });
});
