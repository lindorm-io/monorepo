import { difference } from "lodash";
import { AuthorizationSession, BrowserSession, ClientSession } from "../../entity";

export const verifyRequiredMethods = (
  authorizationSession: AuthorizationSession,
  session: BrowserSession | ClientSession,
): boolean => {
  if (!authorizationSession.requestedLogin.methods.length) return true;
  if (!session.methods.length) return false;

  return !difference(authorizationSession.requestedLogin.methods, session.methods).length;
};
