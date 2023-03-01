import { ServerKoaContext } from "../../types";
import { BROWSER_SESSIONS_COOKIE_NAME } from "../../constant";
import { Environment } from "@lindorm-io/common-types";

export const getBrowserSessionCookies = (ctx: ServerKoaContext): Array<string> => {
  const {
    cookies,
    logger,
    server: { environment },
  } = ctx;

  const cookie = cookies.get(BROWSER_SESSIONS_COOKIE_NAME, {
    signed: environment !== Environment.TEST,
  });

  if (!cookie) {
    logger.debug("Found no cookie");

    return [];
  }

  const value = JSON.parse(cookie) as Array<string>;

  logger.debug("Found cookie", { cookie, value });

  return value;
};
