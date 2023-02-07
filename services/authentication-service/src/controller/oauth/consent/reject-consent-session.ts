import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { RejectConsentRequestParams, RejectConsentResponse } from "@lindorm-io/common-types";
import { ClientScopes } from "../../../common";

type RequestData = RejectConsentRequestParams;

export const rejectConsentSessionSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const rejectConsentSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { oauthClient },
    data: { id },
  } = ctx;

  const { data } = await oauthClient.post<RejectConsentResponse>(
    "/internal/sessions/consent/:id/reject",
    {
      params: { id },
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScopes.OAUTH_CONSENT_WRITE])],
    },
  );

  return { body: data };
};
