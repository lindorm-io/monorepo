import { BROWSER_SESSIONS_COOKIE_NAME } from "../../constant";
import { Environments } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { expiryDate } from "@lindorm-io/expiry";

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
    signed: environment !== Environments.TEST,
  };

  logger.verbose("Setting cookie", {
    name: BROWSER_SESSIONS_COOKIE_NAME,
    value,
    opts,
  });

  cookies.set(BROWSER_SESSIONS_COOKIE_NAME, value, opts);
};
