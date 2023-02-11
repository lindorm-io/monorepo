import { BROWSER_SESSION_COOKIE_NAME } from "../../constant";
import { BrowserSession } from "../../entity";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { Environments } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { getExpiryDate } from "@lindorm-io/expiry";

export const tryFindBrowserSession = async (
  ctx: ServerKoaContext,
): Promise<BrowserSession | undefined> => {
  const {
    repository: { browserSessionRepository },
  } = ctx;

  const cookieId = ctx.cookies.get(BROWSER_SESSION_COOKIE_NAME, {
    signed: ctx.server.environment !== Environments.TEST,
  });

  if (!cookieId) {
    return;
  }

  try {
    const browserSession = await browserSessionRepository.find({ id: cookieId });

    browserSession.expires = browserSession.remember
      ? getExpiryDate(configuration.defaults.expiry.browser_session_remember)
      : getExpiryDate(configuration.defaults.expiry.browser_session);

    return await browserSessionRepository.update(browserSession);
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) throw err;
  }
};
