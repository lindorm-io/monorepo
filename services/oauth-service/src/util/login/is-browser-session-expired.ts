import { BrowserSession } from "../../entity";
import { stringToDurationObject } from "@lindorm-io/expiry";
import { configuration } from "../../server/configuration";
import { add, isAfter } from "date-fns";

export const isBrowserSessionExpired = (browserSession: BrowserSession): boolean => {
  const duration = stringToDurationObject(
    browserSession.remember
      ? configuration.defaults.expiry.browser_session_remember
      : configuration.defaults.expiry.browser_session,
  );

  return isAfter(new Date(), add(browserSession.latestAuthentication, duration));
};
