import { getUnixTime } from "date-fns";
import { AuthorizationSession, BrowserSession } from "../../entity";

export const isLoginRequiredByMaxAge = (
  authorizationSession: AuthorizationSession,
  browserSession: BrowserSession,
): boolean => {
  const { maxAge } = authorizationSession;
  const { latestAuthentication } = browserSession;

  if (!maxAge) {
    return false;
  }

  if (!latestAuthentication) {
    return true;
  }

  const now = getUnixTime(new Date());
  const auth = getUnixTime(latestAuthentication);

  return now - auth > maxAge;
};
