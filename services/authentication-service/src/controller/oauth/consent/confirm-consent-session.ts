import Joi from "joi";
import { ClientScope, JOI_GUID, ResponseWithRedirectBody } from "../../../common";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";

interface RequestData {
  id: string;
  audiences: Array<string>;
  scopes: Array<string>;
}

export const confirmConsentSessionSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
    audiences: Joi.array().items(Joi.string().lowercase()),
    scopes: Joi.array().items(Joi.string().lowercase()),
  })
  .required();

export const confirmConsentSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { oauthClient },
    data: { id, audiences, scopes },
  } = ctx;

  const { data } = await oauthClient.post<ResponseWithRedirectBody>(
    "/internal/sessions/consent/:id/confirm",
    {
      params: { id },
      body: { audiences, scopes },
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_CONSENT_WRITE])],
    },
  );

  return { body: data };
};
