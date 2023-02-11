import Joi from "joi";
import { ClientScopes } from "../../common";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { configuration } from "../../server/configuration";
import { createURL } from "@lindorm-io/url";
import { isUndefined } from "lodash";
import {
  InitialiseAuthOidcRequestParams,
  InitialiseAuthOidcRequestQuery,
  InitialiseOidcSessionRequestBody,
  InitialiseOidcSessionResponse,
} from "@lindorm-io/common-types";

type RequestData = InitialiseAuthOidcRequestParams & InitialiseAuthOidcRequestQuery;

export const initialiseOidcSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
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

  const body: InitialiseOidcSessionRequestBody = {
    callbackId: authenticationSession.id,
    callbackUri: createURL("/sessions/oidc/callback", {
      host: configuration.server.host,
      port: configuration.server.port,
    }).toString(),
    expiresAt: authenticationSession.expires.toISOString(),
    identityId: authenticationSession.identityId || undefined,
    provider,
  };

  const {
    data: { redirectTo },
  } = await oidcClient.post<InitialiseOidcSessionResponse>("/internal/sessions", {
    body,
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScopes.OIDC_SESSION_WRITE])],
  });

  return { redirect: redirectTo };
};
