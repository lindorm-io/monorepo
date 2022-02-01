import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { LOGOUT_SESSION_COOKIE_NAME } from "../../constant";
import { oauthConfirmLogout } from "../../handler";

export const confirmLogoutController: Controller<Context> = async (ctx): ControllerResponse => {
  const {
    cache: { logoutSessionCache },
    entity: { logoutSession },
  } = ctx;

  const { redirectTo } = await oauthConfirmLogout(ctx, logoutSession.oauthSessionId);

  await logoutSessionCache.destroy(logoutSession);

  ctx.deleteCookie(LOGOUT_SESSION_COOKIE_NAME);

  return { redirect: redirectTo };
};
