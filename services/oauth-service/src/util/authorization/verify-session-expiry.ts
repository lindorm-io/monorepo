import { readableDuration } from "@lindorm-io/readable-time";
import { add, isBefore } from "date-fns";
import { BrowserSession, ClientSession } from "../../entity";
import { configuration } from "../../server/configuration";

export const verifySessionExpiry = (session: BrowserSession | ClientSession): boolean => {
  if (!(session instanceof BrowserSession)) return true;

  const duration = readableDuration(
    session.remember
      ? configuration.defaults.expiry.browser_session_remember
      : configuration.defaults.expiry.browser_session,
  );

  return isBefore(new Date(), add(session.latestAuthentication, duration));
};
