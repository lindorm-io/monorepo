import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { configuration } from "../../../server/configuration";
import { createURL } from "@lindorm-io/core";
import { fetchOauthConsentData } from "../../../handler";
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

export const redirectConsentSessionSchema = Joi.object<RequestData>()
  .keys({
    sessionId: JOI_GUID.required(),
  })
  .required();

export const redirectConsentSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { oauthClient },
    data: { sessionId },
    logger,
  } = ctx;

  const {
    consentStatus,
    client: { type },
    requested: { audiences, scopes },
  } = await fetchOauthConsentData(ctx, sessionId);

  if (consentStatus !== SessionStatus.PENDING) {
    logger.warn("Invalid Session Status", { consentStatus });

    const {
      data: { redirectTo },
    } = await oauthClient.get<ResponseWithRedirectBody>("/internal/sessions/consent/:id/verify", {
      params: { id: sessionId },
    });

    return { redirect: redirectTo };
  }

  if (type === ClientType.CONFIDENTIAL) {
    const {
      data: { redirectTo },
    } = await oauthClient.post<ResponseWithRedirectBody>("/internal/sessions/consent/:id/confirm", {
      params: { id: sessionId },
      body: {
        audiences,
        scopes,
      },
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_CONSENT_WRITE])],
    });

    return { redirect: redirectTo };
  }

  return {
    redirect: createURL(configuration.frontend.routes.consent, {
      host: configuration.frontend.host,
      port: configuration.frontend.port,
      query: { sessionId },
    }),
  };
};
