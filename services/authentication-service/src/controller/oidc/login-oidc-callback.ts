import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, LevelOfAssurance } from "../../common";
import { LOGIN_SESSION_COOKIE_NAME } from "../../constant";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { createURL } from "@lindorm-io/core";
import { find } from "lodash";
import { isAuthenticationReadyToConfirm } from "../../util";
import {
  axiosGetOidcSession,
  createAccountCallback,
  oauthConfirmAuthentication,
  resolveAllowedFlows,
} from "../../handler";

interface RequestData {
  sessionId: string;
}

export const loginOidcCallbackSchema = Joi.object<RequestData>({
  sessionId: JOI_GUID.required(),
});

export const loginOidcCallbackController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { loginSessionCache },
    data: { sessionId },
    logger,
    repository: { accountRepository },
  } = ctx;

  let loginSession = ctx.entity.loginSession;

  const { identityId, provider } = await axiosGetOidcSession(ctx, sessionId);

  const config = find(configuration.oidc_providers, { key: provider });

  if (!config) {
    throw new ServerError("Invalid identity provider");
  }

  const account = await accountRepository.findOrCreate(
    { id: identityId },
    createAccountCallback(ctx),
  );

  const loaValue = config.loa_value as LevelOfAssurance;

  logger.debug("Updating login session");

  loginSession.amrValues.push(`oidc_${provider}`);
  loginSession.identityId = account.id;
  loginSession.levelOfAssurance = loaValue;

  if (isAuthenticationReadyToConfirm(loginSession)) {
    const { redirectTo } = await oauthConfirmAuthentication(ctx, loginSession);
    ctx.deleteCookie(LOGIN_SESSION_COOKIE_NAME);
    return { redirect: redirectTo };
  }

  loginSession = await resolveAllowedFlows(ctx, loginSession, account);

  await loginSessionCache.update(loginSession);

  return {
    redirect: createURL(configuration.frontend.routes.login, {
      host: configuration.frontend.host,
      port: configuration.frontend.port,
    }),
  };
};
