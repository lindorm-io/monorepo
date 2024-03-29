import { RejectConsentRequestParams, RejectConsentResponse } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { clientCredentialsMiddleware } from "../../../middleware";
import { ServerKoaController } from "../../../types";

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
    "/admin/sessions/consent/:id/reject",
    {
      params: { id },
      middleware: [clientCredentialsMiddleware()],
    },
  );

  return { body: data };
};
