import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { LOGIN_SESSION_COOKIE_NAME } from "../../constant";
import { oauthRejectAuthentication } from "../../handler";

export const rejectLoginController: Controller<Context> = async (ctx): ControllerResponse => {
  const {
    cache: { loginSessionCache },
    entity: { loginSession },
  } = ctx;

  const { redirectTo } = await oauthRejectAuthentication(ctx, loginSession.oauthSessionId);

  await loginSessionCache.destroy(loginSession);

  ctx.deleteCookie(LOGIN_SESSION_COOKIE_NAME);

  return { redirect: redirectTo };
};
