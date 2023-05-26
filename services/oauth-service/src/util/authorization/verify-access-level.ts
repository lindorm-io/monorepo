import { AuthorizationSession, BrowserSession, ClientSession } from "../../entity";
import { getAdjustedAccessLevel } from "../get-adjusted-access-level";

export const verifyAccessLevel = (
  authorizationSession: AuthorizationSession,
  session: BrowserSession | ClientSession,
): boolean => {
  if (!session.levelOfAssurance) return false;

  const adjustedAccessLevel = getAdjustedAccessLevel(session);

  return (
    adjustedAccessLevel >= authorizationSession.requestedLogin.minimumLevel &&
    adjustedAccessLevel >= authorizationSession.requestedLogin.requiredLevel
  );
};
