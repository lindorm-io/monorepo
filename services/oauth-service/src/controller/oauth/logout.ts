import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID } from "../../common";
import { LogoutSession } from "../../entity";
import { configuration } from "../../configuration";
import { createURL, getExpires } from "@lindorm-io/core";
import { findSessionToLogout, setLogoutSessionCookie } from "../../handler";

interface RequestData {
  clientId: string;
  idTokenHint: string;
  redirectUri: string;
  sessionId: string;
  state: string;
}

interface ResponseQuery {
  logoutId: string;
  display: string;
  uiLocales: Array<string>;
}

export const oauthLogoutSchema = Joi.object({
  clientId: JOI_GUID.required(),
  idTokenHint: Joi.string().optional(),
  redirectUri: Joi.string().uri().optional(),
  sessionId: JOI_GUID.required(),
  state: Joi.string().optional(),
});

export const oauthLogoutController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse<ResponseQuery> => {
  const {
    cache: { logoutSessionCache },
    data: { redirectUri, sessionId, state },
    entity: { client },
    request: { originalUrl },
    token: { idToken },
  } = ctx;

  const { session, type } = await findSessionToLogout(ctx, sessionId);

  const { expires, expiresIn } = getExpires(configuration.expiry.logout_session);

  const logoutSession = await logoutSessionCache.create(
    new LogoutSession({
      clientId: client.id,
      expires,
      idTokenHint: idToken ? idToken.token : null,
      originalUri: new URL(originalUrl, configuration.server.host).toString(),
      redirectUri,
      sessionId: session.id,
      sessionType: type,
      state,
    }),
    expiresIn,
  );

  setLogoutSessionCookie(ctx, logoutSession);

  return {
    redirect: createURL(configuration.redirect.logout, {
      baseUrl: configuration.services.authentication_service,
      query: { sessionId: logoutSession.id },
    }),
  };
};
