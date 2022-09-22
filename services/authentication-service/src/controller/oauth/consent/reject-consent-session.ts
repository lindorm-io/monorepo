import Joi from "joi";
import { ClientScope, JOI_GUID, ResponseWithRedirectBody } from "../../../common";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";

type RequestData = {
  id: string;
};

export const rejectConsentSessionSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const rejectConsentSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { oauthClient },
    data: { id },
  } = ctx;

  const { data } = await oauthClient.post<ResponseWithRedirectBody>(
    "/internal/sessions/consent/:id/reject",
    {
      params: { id },
      middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.OAUTH_CONSENT_WRITE])],
    },
  );

  return { body: data };
};
