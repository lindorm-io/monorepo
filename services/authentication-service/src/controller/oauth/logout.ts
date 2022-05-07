import Joi from "joi";
import { ClientType, JOI_GUID } from "../../common";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { LOGOUT_SESSION_COOKIE_NAME } from "../../constant";
import { LogoutSession } from "../../entity";
import { configuration } from "../../configuration";
import { createURL } from "@lindorm-io/core";
import { oauthConfirmLogout, oauthGetLogoutSessionInfo } from "../../handler";

interface RequestData {
  sessionId: string;
}

export const oauthLogoutSchema = Joi.object<RequestData>({
  sessionId: JOI_GUID.required(),
});

export const oauthLogoutController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { logoutSessionCache },
    data: { sessionId },
  } = ctx;

  const {
    client: { name, logoUri, description, type },
    logoutSession: { expiresAt, expiresIn },
  } = await oauthGetLogoutSessionInfo(ctx, sessionId);

  if (type === ClientType.CONFIDENTIAL) {
    const { redirectTo } = await oauthConfirmLogout(ctx, sessionId);
    return { redirect: redirectTo };
  }

  const logoutSession = await logoutSessionCache.create(
    new LogoutSession({
      description: description,
      expires: new Date(expiresAt),
      logoUri: logoUri,
      name: name,
      oauthSessionId: sessionId,
      type: type,
    }),
    expiresIn,
  );

  ctx.setCookie(LOGOUT_SESSION_COOKIE_NAME, logoutSession.id, { expiry: logoutSession.expires });

  return {
    redirect: createURL(configuration.frontend.routes.logout, {
      baseUrl: configuration.frontend.base_url,
    }),
  };
};
