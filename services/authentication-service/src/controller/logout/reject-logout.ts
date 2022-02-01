import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { LOGOUT_SESSION_COOKIE_NAME } from "../../constant";
import { oauthRejectLogout } from "../../handler";

export const rejectLogoutController: Controller<Context> = async (ctx): ControllerResponse => {
  const {
    cache: { logoutSessionCache },
    entity: { logoutSession },
  } = ctx;

  const { redirectTo } = await oauthRejectLogout(ctx, logoutSession.oauthSessionId);

  await logoutSessionCache.destroy(logoutSession);

  ctx.deleteCookie(LOGOUT_SESSION_COOKIE_NAME);

  return { redirect: redirectTo };
};
