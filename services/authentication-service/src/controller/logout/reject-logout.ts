import { ControllerResponse } from "@lindorm-io/koa";
import { LOGOUT_SESSION_COOKIE_NAME } from "../../constant";
import { ServerKoaController } from "../../types";
import { rejectOauthLogoutSession } from "../../handler";

export const rejectLogoutController: ServerKoaController = async (ctx): ControllerResponse => {
  const {
    cache: { logoutSessionCache },
    entity: { logoutSession },
  } = ctx;

  const { redirectTo } = await rejectOauthLogoutSession(ctx, logoutSession.oauthSessionId);

  await logoutSessionCache.destroy(logoutSession);

  ctx.deleteCookie(LOGOUT_SESSION_COOKIE_NAME);

  return { redirect: redirectTo };
};
