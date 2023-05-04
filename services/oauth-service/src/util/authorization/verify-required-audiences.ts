import { difference } from "lodash";
import { AuthorizationSession, ClientSession } from "../../entity";

export const verifyRequiredAudiences = (
  authorizationSession: AuthorizationSession,
  clientSession: ClientSession,
): boolean => {
  if (!clientSession.audiences.length) return false;

  return !difference(authorizationSession.requestedConsent.audiences, clientSession.audiences)
    .length;
};
