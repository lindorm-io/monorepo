import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID } from "../../common";
import { LogoutSession } from "../../entity";
import { configuration } from "../../server/configuration";
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

export const oauthLogoutSchema = Joi.object()
  .keys({
    clientId: JOI_GUID.required(),
    idTokenHint: Joi.string().optional(),
    redirectUri: Joi.string().uri().optional(),
    sessionId: JOI_GUID.required(),
    state: Joi.string().optional(),
  })
  .required();

export const oauthLogoutController: ServerKoaController<RequestData> = async (
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

  const { expires, expiresIn } = getExpires(configuration.defaults.expiry.logout_session);

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
      host: configuration.services.authentication_service.host,
      port: configuration.services.authentication_service.port,
      query: { sessionId: logoutSession.id },
    }),
  };
};
