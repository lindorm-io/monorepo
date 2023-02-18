import { AccessSession, AuthorizationSession, BrowserSession, RefreshSession } from "../../entity";
import { getUnixTime } from "date-fns";

export const isLoginRequiredByMaxAge = (
  authorizationSession: AuthorizationSession,
  browserSession: AccessSession | BrowserSession | RefreshSession,
): boolean => {
  if (!authorizationSession.maxAge) {
    return false;
  }

  const now = getUnixTime(new Date());
  const authTime = getUnixTime(browserSession.latestAuthentication);

  return now - authTime > authorizationSession.maxAge;
};
