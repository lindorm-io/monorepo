import { AuthorizationSession, BrowserSession, ClientSession } from "../../entity";
import { OpenIdPromptMode, SessionStatus } from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";
import { isNewConsentRequired } from "./is-new-consent-required";

export const isConsentRequired = (
  authorizationSession: AuthorizationSession,
  browserSession?: BrowserSession,
  clientSession?: ClientSession,
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

  if (clientSession) {
    return isNewConsentRequired(authorizationSession, clientSession);
  }

  return true;
};
