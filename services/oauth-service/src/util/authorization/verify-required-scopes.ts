import { difference } from "lodash";
import { AuthorizationSession, ClientSession } from "../../entity";

export const verifyRequiredScopes = (
  authorizationSession: AuthorizationSession,
  clientSession: ClientSession,
): boolean => {
  if (!clientSession.scopes.length) return false;

  return !difference(authorizationSession.requestedConsent.scopes, clientSession.scopes).length;
};
