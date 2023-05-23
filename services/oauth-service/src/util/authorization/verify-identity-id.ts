import { AuthorizationRequest, BrowserSession, ClientSession } from "../../entity";

export const verifyIdentityId = (
  authorizationRequest: AuthorizationRequest,
  session: BrowserSession | ClientSession,
): boolean => {
  if (!authorizationRequest.requestedLogin.identityId) return true;

  return authorizationRequest.requestedLogin.identityId === session.identityId;
};
