import { AuthorizationSession, BrowserSession, ConsentSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
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

  if (["confirmed", "verified"].includes(authorizationSession.status.consent)) {
    return false;
  }

  if (!browserSession) {
    return true;
  }

  if (!consentSession) {
    return true;
  }

  if (!consentSession.audiences.length || !consentSession.scopes.length) {
    return true;
  }

  if (
    difference(authorizationSession.requestedConsent.audiences, consentSession.audiences).length
  ) {
    return true;
  }

  if (difference(authorizationSession.requestedConsent.scopes, consentSession.scopes).length) {
    return true;
  }

  return false;
};
