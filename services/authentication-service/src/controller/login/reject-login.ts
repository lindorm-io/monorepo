import { ControllerResponse } from "@lindorm-io/koa";
import { LOGIN_SESSION_COOKIE_NAME } from "../../constant";
import { ServerKoaController } from "../../types";
import { oauthRejectAuthentication } from "../../handler";

export const rejectLoginController: ServerKoaController = async (ctx): ControllerResponse => {
  const {
    cache: { loginSessionCache },
    entity: { loginSession },
  } = ctx;

  const { redirectTo } = await oauthRejectAuthentication(ctx, loginSession.oauthSessionId);

  await loginSessionCache.destroy(loginSession);

  ctx.deleteCookie(LOGIN_SESSION_COOKIE_NAME);

  return { redirect: redirectTo };
};
