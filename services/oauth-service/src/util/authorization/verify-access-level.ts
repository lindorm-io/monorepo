import { AuthorizationRequest, BrowserSession, ClientSession } from "../../entity";
import { getAdjustedAccessLevel } from "../get-adjusted-access-level";

export const verifyAccessLevel = (
  authorizationRequest: AuthorizationRequest,
  session: BrowserSession | ClientSession,
): boolean => {
  if (!session.levelOfAssurance) return false;

  const adjustedAccessLevel = getAdjustedAccessLevel(session);

  return (
    adjustedAccessLevel >= authorizationRequest.requestedLogin.minimumLevel &&
    adjustedAccessLevel >= authorizationRequest.requestedLogin.requiredLevel
  );
};
