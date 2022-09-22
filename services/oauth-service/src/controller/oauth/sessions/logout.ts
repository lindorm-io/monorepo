import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, JOI_JWT, JOI_STATE } from "../../../common";
import { LogoutSession } from "../../../entity";
import { ServerKoaController } from "../../../types";
import { configuration } from "../../../server/configuration";
import { createURL, getExpiryDate } from "@lindorm-io/core";
import { findSessionToLogout } from "../../../handler";

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
    idTokenHint: JOI_JWT.optional(),
    redirectUri: Joi.string().uri().optional(),
    sessionId: JOI_GUID.required(),
    state: JOI_STATE.optional(),
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

  const { session, type } = await findSessionToLogout(ctx, sessionId, idToken?.sessionHint);

  const expires = getExpiryDate(configuration.defaults.expiry.logout_session);

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
  );

  return {
    redirect: createURL(configuration.redirect.logout, {
      host: configuration.services.authentication_service.host,
      port: configuration.services.authentication_service.port,
      query: { sessionId: logoutSession.id },
    }),
  };
};
