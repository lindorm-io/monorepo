import { difference } from "lodash";
import { AuthorizationSession, BrowserSession, ClientSession } from "../../entity";

export const verifyRequiredMethods = (
  authorizationSession: AuthorizationSession,
  session: BrowserSession | ClientSession,
): boolean => {
  if (!authorizationSession.requestedLogin.requiredMethods.length) return true;
  if (!session.methods.length) return false;

  return !difference(authorizationSession.requestedLogin.requiredMethods, session.methods).length;
};
