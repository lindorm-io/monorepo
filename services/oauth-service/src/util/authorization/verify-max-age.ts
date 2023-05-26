import { getUnixTime } from "date-fns";
import { AuthorizationSession, BrowserSession, ClientSession } from "../../entity";

export const verifyMaxAge = (
  authorizationSession: AuthorizationSession,
  session: BrowserSession | ClientSession,
): boolean => {
  if (!authorizationSession.maxAge) return true;

  const now = getUnixTime(new Date());
  const authTime = getUnixTime(session.latestAuthentication);

  return authorizationSession.maxAge >= now - authTime;
};
