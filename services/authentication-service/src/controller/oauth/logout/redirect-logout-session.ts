import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { configuration } from "../../../server/configuration";
import { createURL } from "@lindorm-io/url";
import { fetchOauthLogoutData } from "../../../handler";
import { ClientScopes } from "../../../common";
import {
  ConfirmLogoutResponse,
  OauthClientTypes,
  RedirectLogoutResponse,
  SessionStatuses,
} from "@lindorm-io/common-types";

interface RequestData {
  sessionId: string;
}

export const redirectLogoutSessionSchema = Joi.object<RequestData>()
  .keys({
    sessionId: Joi.string().guid().required(),
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

  if (logoutStatus !== SessionStatuses.PENDING) {
    logger.warn("Invalid Session Status", { logoutStatus });

    const {
      data: { redirectTo },
    } = await oauthClient.get<RedirectLogoutResponse>("/internal/sessions/logout/:id/redirect", {
      params: { id: sessionId },
    });

    return { redirect: redirectTo };
  }

  if (type === OauthClientTypes.CONFIDENTIAL) {
    const {
      data: { redirectTo },
    } = await oauthClient.post<ConfirmLogoutResponse>("/internal/sessions/logout/:id/confirm", {
      params: { id: sessionId },
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScopes.OAUTH_LOGOUT_WRITE])],
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
