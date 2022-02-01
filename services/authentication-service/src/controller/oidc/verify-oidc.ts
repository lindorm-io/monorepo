import Joi from "joi";
import { Account } from "../../entity";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { LOGIN_SESSION_COOKIE_NAME, OIDC_SESSION_COOKIE_NAME } from "../../constant";
import { LevelOfAssurance, ResponseType } from "../../common";
import { ServerError } from "@lindorm-io/errors";
import { configuration } from "../../configuration";
import { createURL } from "@lindorm-io/core";
import { find } from "lodash";
import { isAuthenticationReadyToConfirm } from "../../util";
import {
  oauthConfirmAuthentication,
  resolveAllowedFlows,
  verifyOidcWithAccessToken,
  verifyOidcWithCode,
  verifyOidcWithIdToken,
} from "../../handler";

interface RequestData {
  accessToken: string;
  code: string;
  expiresIn: number;
  idToken: string;
  state: string;
  tokenType: string;
}

export const verifyOidcSchema = Joi.object<RequestData>({
  accessToken: Joi.string().optional(),
  code: Joi.string().optional(),
  expiresIn: Joi.string().optional(),
  idToken: Joi.string().optional(),
  state: Joi.string().required(),
  tokenType: Joi.string().optional(),
});

export const verifyOidcController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { loginSessionCache },
    data: { accessToken, code, idToken },
    entity: { oidcSession },
    logger,
  } = ctx;

  let loginSession = ctx.entity.loginSession;

  let loaValue: LevelOfAssurance;
  let responseType: ResponseType;

  const oidcConfiguration = find(configuration.oidc_providers, {
    key: oidcSession.identityProvider,
  });

  if (!oidcConfiguration) {
    throw new ServerError("Invalid identity provider");
  }

  loaValue = oidcConfiguration.loa_value as LevelOfAssurance;
  responseType = oidcConfiguration.response_type as ResponseType;

  let account: Account;

  switch (responseType) {
    case ResponseType.CODE:
      account = await verifyOidcWithCode(ctx, loginSession, oidcSession, code);
      break;

    case ResponseType.ID_TOKEN:
      account = await verifyOidcWithIdToken(ctx, loginSession, oidcSession, idToken);
      break;

    case ResponseType.TOKEN:
      account = await verifyOidcWithAccessToken(ctx, loginSession, oidcSession, accessToken);
      break;

    default:
      throw new ServerError("Unknown response type");
  }

  logger.debug("Updating login session");

  loginSession.amrValues.push(`oidc_${oidcSession.identityProvider}`);
  loginSession.identityId = account.id;
  loginSession.levelOfAssurance = loaValue;

  ctx.deleteCookie(OIDC_SESSION_COOKIE_NAME);

  if (isAuthenticationReadyToConfirm(loginSession)) {
    const { redirectTo } = await oauthConfirmAuthentication(ctx, loginSession);

    ctx.deleteCookie(LOGIN_SESSION_COOKIE_NAME);

    return { redirect: redirectTo };
  }

  loginSession = await resolveAllowedFlows(ctx, loginSession, account);

  await loginSessionCache.update(loginSession);

  return {
    redirect: createURL(configuration.frontend.routes.login, {
      baseUrl: configuration.frontend.base_url,
    }),
  };
};
