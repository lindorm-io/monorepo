import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { configuration } from "../../server/configuration";
import { createURL } from "@lindorm-io/core";
import { isUndefined } from "lodash";
import {
  ClientScope,
  InitialiseOidcSessionRequestData,
  InitialiseOidcSessionResponseBody,
  JOI_GUID,
} from "../../common";

type RequestData = {
  id: string;
  provider: string;
  remember?: boolean;
};

export const initialiseOidcSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
    provider: Joi.string().required(),
    remember: Joi.boolean().optional(),
  })
  .options({ abortEarly: false, allowUnknown: false })
  .required();

export const initialiseOidcController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { oauthClient, oidcClient },
    cache: { authenticationSessionCache },
    data: { provider, remember },
    entity: { authenticationSession },
  } = ctx;

  if (!isUndefined(remember)) {
    authenticationSession.remember = remember;
    await authenticationSessionCache.update(authenticationSession);
  }

  const body: InitialiseOidcSessionRequestData = {
    callbackId: authenticationSession.id,
    callbackUri: createURL("/sessions/oidc/callback", {
      host: configuration.server.host,
      port: configuration.server.port,
    }).toString(),
    expiresAt: authenticationSession.expires.toISOString(),
    identityId: authenticationSession.identityId,
    provider,
  };

  const {
    data: { redirectTo },
  } = await oidcClient.post<InitialiseOidcSessionResponseBody>("/internal/sessions", {
    body,
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.OIDC_SESSION_WRITE])],
  });

  return { redirect: redirectTo };
};
