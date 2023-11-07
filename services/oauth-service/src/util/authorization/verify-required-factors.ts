import { difference } from "lodash";
import { AuthorizationSession, BrowserSession, ClientSession } from "../../entity";

export const verifyRequiredFactors = (
  authorizationSession: AuthorizationSession,
  session: BrowserSession | ClientSession,
): boolean => {
  if (!authorizationSession.requestedLogin.factors.length) return true;
  if (!session.factors.length) return false;

  return !difference(authorizationSession.requestedLogin.factors, session.factors).length;
};
