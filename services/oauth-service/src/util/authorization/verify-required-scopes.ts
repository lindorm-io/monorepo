import { difference } from "lodash";
import { AuthorizationRequest, ClientSession } from "../../entity";

export const verifyRequiredScopes = (
  authorizationRequest: AuthorizationRequest,
  clientSession: ClientSession,
): boolean => {
  if (!clientSession.scopes.length) return false;

  return !difference(authorizationRequest.requestedConsent.scopes, clientSession.scopes).length;
};
