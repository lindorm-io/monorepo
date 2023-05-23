import { difference } from "lodash";
import { AuthorizationRequest, ClientSession } from "../../entity";

export const verifyRequiredAudiences = (
  authorizationRequest: AuthorizationRequest,
  clientSession: ClientSession,
): boolean => {
  if (!clientSession.audiences.length) return false;

  return !difference(authorizationRequest.requestedConsent.audiences, clientSession.audiences)
    .length;
};
