import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_JWT } from "../../common";
import { LOGIN_SESSION_COOKIE_NAME } from "../../constant";
import { ServerKoaController } from "../../types";
import { confirmOauthAuthenticationSession } from "../../handler";

interface RequestData {
  authenticationConfirmationToken: string;
  expiresIn: number;
}

export const confirmLoginWithAuthenticationTokenSchema = Joi.object<RequestData>({
  authenticationConfirmationToken: JOI_JWT.required(),
  expiresIn: Joi.number().optional(),
});

export const confirmLoginWithAuthenticationTokenController: ServerKoaController<
  RequestData
> = async (ctx): ControllerResponse => {
  const {
    cache: { loginSessionCache },
    entity: { loginSession },
    token: { authenticationConfirmationToken },
  } = ctx;

  const { redirectTo } = await confirmOauthAuthenticationSession(ctx, loginSession.oauthSessionId, {
    acrValues: authenticationConfirmationToken.authContextClass,
    amrValues: authenticationConfirmationToken.authMethodsReference,
    identityId: authenticationConfirmationToken.subject,
    levelOfAssurance: authenticationConfirmationToken.levelOfAssurance,
    remember: authenticationConfirmationToken.claims.remember,
  });

  await loginSessionCache.destroy(loginSession);

  ctx.deleteCookie(LOGIN_SESSION_COOKIE_NAME);

  return { redirect: redirectTo };
};
