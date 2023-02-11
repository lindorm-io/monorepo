import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { InitialiseLogoutRequestQuery } from "@lindorm-io/common-types";
import { JOI_JWT, JOI_STATE } from "../../../common";
import { LogoutSession } from "../../../entity";
import { ServerKoaController } from "../../../types";
import { configuration } from "../../../server/configuration";
import { createURL } from "@lindorm-io/url";
import { expiryDate } from "@lindorm-io/expiry";
import { findSessionToLogout } from "../../../handler";

type RequestData = InitialiseLogoutRequestQuery;

export const oauthLogoutSchema = Joi.object<RequestData>()
  .keys({
    clientId: Joi.string().guid().required(),
    idTokenHint: JOI_JWT,
    redirectUri: Joi.string().uri(),
    sessionId: Joi.string().guid().required(),
    state: JOI_STATE,
  })
  .required();

export const oauthLogoutController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { logoutSessionCache },
    data: { redirectUri, sessionId, state },
    entity: { client },
    request: { originalUrl },
    token: { idToken },
  } = ctx;

  const { session, type } = await findSessionToLogout(ctx, sessionId, idToken?.sessionHint);

  const expires = expiryDate(configuration.defaults.expiry.logout_session);

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
