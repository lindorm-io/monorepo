import { AccessSession, AuthorizationSession, BrowserSession, RefreshSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { OpenIdPromptMode, SessionStatus } from "@lindorm-io/common-types";
import { isNewConsentRequired } from "./is-new-consent-required";

export const isConsentRequired = (
  authorizationSession: AuthorizationSession,
  browserSession?: BrowserSession,
  accessSession?: AccessSession,
  refreshSession?: RefreshSession,
): boolean => {
  if (!authorizationSession) {
    throw new ServerError("Session not found", {
      debug: { authorizationSession },
    });
  }

  if (
    authorizationSession.status.consent === SessionStatus.CONFIRMED ||
    authorizationSession.status.consent === SessionStatus.VERIFIED
  ) {
    return false;
  }

  if (authorizationSession.promptModes.includes(OpenIdPromptMode.CONSENT)) {
    return true;
  }

  if (!browserSession) {
    return true;
  }

  if (accessSession) {
    return isNewConsentRequired(authorizationSession, accessSession);
  }

  if (refreshSession) {
    return isNewConsentRequired(authorizationSession, refreshSession);
  }

  return true;
};
