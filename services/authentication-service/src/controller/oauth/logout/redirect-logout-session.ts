import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { configuration } from "../../../server/configuration";
import { createURL } from "@lindorm-io/core";
import { fetchOauthLogoutData } from "../../../handler";
import {
  ClientScope,
  ClientType,
  JOI_GUID,
  ResponseWithRedirectBody,
  SessionStatus,
} from "../../../common";

interface RequestData {
  sessionId: string;
}

export const redirectLogoutSessionSchema = Joi.object<RequestData>()
  .keys({
    sessionId: JOI_GUID.required(),
  })
  .required();

export const redirectLogoutSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { oauthClient },
    data: { sessionId },
    logger,
  } = ctx;

  const {
    logoutStatus,
    client: { type },
  } = await fetchOauthLogoutData(ctx, sessionId);

  if (logoutStatus !== SessionStatus.PENDING) {
    logger.warn("Invalid Session Status", { logoutStatus });

    const {
      data: { redirectTo },
    } = await oauthClient.get<ResponseWithRedirectBody>("/internal/sessions/logout/:id/verify", {
      params: { id: sessionId },
    });

    return { redirect: redirectTo };
  }

  if (type === ClientType.CONFIDENTIAL) {
    const {
      data: { redirectTo },
    } = await oauthClient.post<ResponseWithRedirectBody>("/internal/sessions/logout/:id/confirm", {
      params: { id: sessionId },
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_LOGOUT_WRITE])],
    });

    return { redirect: redirectTo };
  }

  return {
    redirect: createURL(configuration.frontend.routes.logout, {
      host: configuration.frontend.host,
      port: configuration.frontend.port,
      query: { sessionId },
    }),
  };
};
