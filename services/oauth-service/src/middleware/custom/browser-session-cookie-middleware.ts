import { BROWSER_SESSION_COOKIE_NAME } from "../../constant";
import { BrowserSession } from "../../entity";
import { ServerKoaMiddleware } from "../../types";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { configuration } from "../../server/configuration";
import { getExpiryDate } from "@lindorm-io/core";
import { setBrowserSessionCookie } from "../../handler";

export const browserSessionCookieMiddleware: ServerKoaMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  const {
    repository: { browserSessionRepository },
  } = ctx;

  const cookieId = ctx.getCookie(BROWSER_SESSION_COOKIE_NAME);

  if (cookieId) {
    try {
      const browserSession = await browserSessionRepository.find({ id: cookieId });

      browserSession.expires = browserSession.remember
        ? getExpiryDate(configuration.defaults.browser_session_remember_expiry)
        : getExpiryDate(configuration.defaults.browser_session_expiry);

      ctx.entity.browserSession = await browserSessionRepository.update(browserSession);
    } catch (err) {
      if (!(err instanceof EntityNotFoundError)) {
        throw err;
      }
    }
  }

  if (!ctx.entity.browserSession) {
    ctx.entity.browserSession = await browserSessionRepository.create(
      new BrowserSession({
        id: cookieId,
        expires: getExpiryDate(configuration.defaults.browser_session_expiry),
      }),
    );
  }

  setBrowserSessionCookie(ctx, ctx.entity.browserSession);

  await next();
};
