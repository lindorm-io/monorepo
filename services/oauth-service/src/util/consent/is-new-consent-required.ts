import { AccessSession, AuthorizationSession, RefreshSession } from "../../entity";
import { difference } from "lodash";

export const isNewConsentRequired = (
  authorizationSession: AuthorizationSession,
  session?: AccessSession | RefreshSession,
): boolean => {
  if (!session) return true;

  if (!session.audiences.length || !session.scopes.length) {
    return true;
  }

  if (difference(authorizationSession.requestedConsent.audiences, session.audiences).length) {
    return true;
  }

  return !!difference(authorizationSession.requestedConsent.scopes, session.scopes).length;
};
