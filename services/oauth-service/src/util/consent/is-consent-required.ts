import { AuthorizationSession, BrowserSession, ConsentSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { SessionStatus } from "../../common";
import { difference } from "lodash";

export const isConsentRequired = (
  authorizationSession: AuthorizationSession,
  browserSession: BrowserSession,
  consentSession: ConsentSession,
): boolean => {
  if (!authorizationSession) {
    throw new ServerError("Internal Server Error", {
      description: "Authorization Session is missing",
    });
  }

  if (!browserSession) {
    throw new ServerError("Internal Server Error", {
      description: "Browser Session is missing",
    });
  }

  if (authorizationSession.consentStatus === SessionStatus.CONFIRMED) {
    return false;
  }

  if (!consentSession) {
    return true;
  }

  if (!consentSession.audiences.length || !consentSession.scopes.length) {
    return true;
  }

  if (!consentSession.audiences.includes(authorizationSession.clientId)) {
    return true;
  }

  if (difference(authorizationSession.scopes, consentSession.scopes).length) {
    return true;
  }

  return false;
};
