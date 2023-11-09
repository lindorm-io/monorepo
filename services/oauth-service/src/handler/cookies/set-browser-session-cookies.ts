import { Environment } from "@lindorm-io/common-enums";
import { expiryDate } from "@lindorm-io/expiry";
import { BROWSER_SESSIONS_COOKIE_NAME } from "../../constant";
import { ServerKoaContext } from "../../types";

export const setBrowserSessionCookies = (
  ctx: ServerKoaContext,
  browserSessions: Array<string>,
): void => {
  const {
    cookies,
    logger,
    server: { environment },
  } = ctx;

  if (!browserSessions.length) {
    logger.verbose("Removing cookie", { name: BROWSER_SESSIONS_COOKIE_NAME });

    cookies.set(BROWSER_SESSIONS_COOKIE_NAME);

    return;
  }

  const value = JSON.stringify(browserSessions);
  const opts = {
    expires: expiryDate("99 years"),
    httpOnly: true,
    overwrite: true,
    signed: environment !== Environment.TEST,
  };

  logger.verbose("Setting cookie", {
    name: BROWSER_SESSIONS_COOKIE_NAME,
    value,
    opts,
  });

  cookies.set(BROWSER_SESSIONS_COOKIE_NAME, value, opts);
};
