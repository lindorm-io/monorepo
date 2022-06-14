import { ControllerResponse } from "@lindorm-io/koa";
import { LOGIN_SESSION_COOKIE_NAME } from "../../constant";
import { ServerKoaController } from "../../types";
import { rejectOauthAuthenticationSession } from "../../handler";

export const rejectLoginController: ServerKoaController = async (ctx): ControllerResponse => {
  const {
    cache: { authenticationSessionCache, loginSessionCache },
    entity: { authenticationSession, loginSession },
  } = ctx;

  const { redirectTo } = await rejectOauthAuthenticationSession(ctx, loginSession.oauthSessionId);

  await authenticationSessionCache.destroy(authenticationSession);
  await loginSessionCache.destroy(loginSession);

  ctx.deleteCookie(LOGIN_SESSION_COOKIE_NAME);

  return { redirect: redirectTo };
};
