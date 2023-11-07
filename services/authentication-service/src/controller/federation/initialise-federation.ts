import {
  InitialiseAuthFederationRequestParams,
  InitialiseAuthFederationRequestQuery,
  InitialiseFederationSessionRequestBody,
  InitialiseFederationSessionResponse,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import { createURL } from "@lindorm-io/url";
import Joi from "joi";
import { isUndefined } from "lodash";
import { clientCredentialsMiddleware } from "../../middleware";
import { configuration } from "../../server/configuration";
import { ServerKoaController } from "../../types";

type RequestData = InitialiseAuthFederationRequestParams & InitialiseAuthFederationRequestQuery;

export const initialiseFederationSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    provider: Joi.string().required(),
    remember: Joi.boolean().optional(),
  })
  .options({ abortEarly: false, allowUnknown: false })
  .required();

export const initialiseFederationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { federationClient },
    redis: { authenticationSessionCache },
    data: { provider, remember },
    entity: { authenticationSession },
  } = ctx;

  if (!isUndefined(remember)) {
    authenticationSession.remember = remember;
    await authenticationSessionCache.update(authenticationSession);
  }

  const body: InitialiseFederationSessionRequestBody = {
    callbackId: authenticationSession.id,
    callbackUri: createURL("/sessions/federation/callback", {
      host: configuration.server.host,
      port: configuration.server.port,
    }).toString(),
    expires: authenticationSession.expires.toISOString(),
    identityId: authenticationSession.identityId || undefined,
    provider,
  };

  const {
    data: { redirectTo },
  } = await federationClient.post<InitialiseFederationSessionResponse>("/admin/sessions", {
    body,
    middleware: [clientCredentialsMiddleware()],
  });

  return { redirect: redirectTo };
};
