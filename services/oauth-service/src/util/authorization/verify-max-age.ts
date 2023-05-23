import { getUnixTime } from "date-fns";
import { AuthorizationRequest, BrowserSession, ClientSession } from "../../entity";

export const verifyMaxAge = (
  authorizationRequest: AuthorizationRequest,
  session: BrowserSession | ClientSession,
): boolean => {
  if (!authorizationRequest.maxAge) return true;

  const now = getUnixTime(new Date());
  const authTime = getUnixTime(session.latestAuthentication);

  return authorizationRequest.maxAge >= now - authTime;
};
