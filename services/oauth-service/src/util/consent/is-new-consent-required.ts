import { AuthorizationSession, ClientSession } from "../../entity";
import { difference } from "lodash";

export const isNewConsentRequired = (
  authorizationSession: AuthorizationSession,
  clientSession?: ClientSession,
): boolean => {
  if (!clientSession) return true;

  if (!clientSession.audiences.length || !clientSession.scopes.length) {
    return true;
  }

  if (difference(authorizationSession.requestedConsent.audiences, clientSession.audiences).length) {
    return true;
  }

  return !!difference(authorizationSession.requestedConsent.scopes, clientSession.scopes).length;
};
