import { BROWSER_SESSION_COOKIE_NAME } from "../../constant";
import { BrowserSession } from "../../entity";
import { ServerKoaContext } from "../../types";

export const setBrowserSessionCookie = (
  ctx: ServerKoaContext,
  browserSession: BrowserSession,
): void => {
  ctx.setCookie(
    BROWSER_SESSION_COOKIE_NAME,
    browserSession.id,
    browserSession.remember ? { expiry: browserSession.expires } : undefined,
  );
};
