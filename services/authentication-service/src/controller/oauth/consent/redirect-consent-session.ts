import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { configuration } from "../../../server/configuration";
import { createURL } from "@lindorm-io/url";
import { fetchOauthConsentData } from "../../../handler";
import { ClientScopes } from "../../../common";
import {
  ConfirmConsentResponse,
  OauthClientTypes,
  RedirectConsentResponse,
  SessionStatuses,
} from "@lindorm-io/common-types";

type RequestData = {
  sessionId: string;
};

export const redirectConsentSessionSchema = Joi.object<RequestData>()
  .keys({
    sessionId: Joi.string().guid().required(),
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

  if (consentStatus !== SessionStatuses.PENDING) {
    logger.warn("Invalid Session Status", { consentStatus });

    const {
      data: { redirectTo },
    } = await oauthClient.get<RedirectConsentResponse>("/internal/sessions/consent/:id/redirect", {
      params: { id: sessionId },
    });

    return { redirect: redirectTo };
  }

  if (type === OauthClientTypes.CONFIDENTIAL) {
    const {
      data: { redirectTo },
    } = await oauthClient.post<ConfirmConsentResponse>("/internal/sessions/consent/:id/confirm", {
      params: { id: sessionId },
      body: {
        audiences,
        scopes,
      },
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScopes.OAUTH_CONSENT_WRITE])],
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
