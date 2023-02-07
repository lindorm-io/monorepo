import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { ClientScopes } from "../../../common";
import {
  ConfirmConsentRequestBody,
  ConfirmConsentRequestParams,
  ConfirmConsentResponse,
} from "@lindorm-io/common-types";

type RequestData = ConfirmConsentRequestParams & ConfirmConsentRequestBody;

type ResponseBody = ConfirmConsentResponse;

export const confirmConsentSessionSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    audiences: Joi.array().items(Joi.string().lowercase()),
    scopes: Joi.array().items(Joi.string().lowercase()),
  })
  .required();

export const confirmConsentSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    axios: { oauthClient },
    data: { id, audiences, scopes },
  } = ctx;

  const { data } = await oauthClient.post<ConfirmConsentResponse>(
    "/internal/sessions/consent/:id/confirm",
    {
      params: { id },
      body: { audiences, scopes },
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScopes.OAUTH_CONSENT_WRITE])],
    },
  );

  return { body: data };
};
