import { AuthorizationSession, BrowserSession, ClientSession } from "../../entity";

export const verifyIdentityId = (
  authorizationSession: AuthorizationSession,
  session: BrowserSession | ClientSession,
): boolean => {
  if (!authorizationSession.requestedLogin.identityId) return true;

  return authorizationSession.requestedLogin.identityId === session.identityId;
};
