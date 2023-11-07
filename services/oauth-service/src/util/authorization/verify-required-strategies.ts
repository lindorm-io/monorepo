import { difference } from "lodash";
import { AuthorizationSession, BrowserSession, ClientSession } from "../../entity";

export const verifyRequiredStrategies = (
  authorizationSession: AuthorizationSession,
  session: BrowserSession | ClientSession,
): boolean => {
  if (!authorizationSession.requestedLogin.strategies.length) return true;
  if (!session.strategies.length) return false;

  return !difference(authorizationSession.requestedLogin.strategies, session.strategies).length;
};
