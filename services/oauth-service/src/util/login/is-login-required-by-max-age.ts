import { AuthorizationSession, BrowserSession, ClientSession } from "../../entity";
import { getUnixTime } from "date-fns";

export const isLoginRequiredByMaxAge = (
  authorizationSession: AuthorizationSession,
  session: BrowserSession | ClientSession,
): boolean => {
  if (!authorizationSession.maxAge) {
    return false;
  }

  const now = getUnixTime(new Date());
  const authTime = getUnixTime(session.latestAuthentication);

  return now - authTime > authorizationSession.maxAge;
};
