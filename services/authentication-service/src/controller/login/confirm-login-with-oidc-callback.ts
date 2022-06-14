import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID } from "../../common";
import { LOGIN_SESSION_COOKIE_NAME } from "../../constant";
import { ServerKoaController } from "../../types";
import { confirmOauthAuthenticationSession, fetchOidcSessionInfo } from "../../handler";

interface RequestData {
  sessionId: string;
}

export const confirmLoginWithOidcCallbackSchema = Joi.object<RequestData>({
  sessionId: JOI_GUID.required(),
});

export const confirmLoginWithOidcCallbackController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { loginSessionCache },
    data: { sessionId },
    entity: { loginSession },
  } = ctx;

  const { identityId, levelOfAssurance, provider } = await fetchOidcSessionInfo(ctx, sessionId);

  const { redirectTo } = await confirmOauthAuthenticationSession(ctx, loginSession.oauthSessionId, {
    acrValues: [`loa_${levelOfAssurance}`],
    amrValues: [`oidc_${provider}`],
    identityId,
    levelOfAssurance,
    remember: loginSession.remember,
  });

  await loginSessionCache.destroy(loginSession);

  ctx.deleteCookie(LOGIN_SESSION_COOKIE_NAME);

  return { redirect: redirectTo };
};
