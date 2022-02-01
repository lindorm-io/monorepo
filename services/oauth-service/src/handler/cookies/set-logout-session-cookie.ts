import { Context } from "../../types";
import { LOGOUT_SESSION_COOKIE_NAME } from "../../constant";
import { LogoutSession } from "../../entity";

export const setLogoutSessionCookie = (ctx: Context, logoutSession: LogoutSession): void => {
  ctx.setCookie(LOGOUT_SESSION_COOKIE_NAME, logoutSession.id, logoutSession.expires);
};
