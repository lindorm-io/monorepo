import { BROWSER_SESSION_COOKIE_NAME } from "../../constant";
import { BrowserSession } from "../../entity";
import { Context } from "../../types";

export const setBrowserSessionCookie = (ctx: Context, browserSession: BrowserSession): void => {
  ctx.setCookie(
    BROWSER_SESSION_COOKIE_NAME,
    browserSession.id,
    browserSession.remember ? browserSession.expires : undefined,
  );
};
