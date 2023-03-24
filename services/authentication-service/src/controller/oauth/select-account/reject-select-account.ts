import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { RejectConsentRequestParams, RejectConsentResponse } from "@lindorm-io/common-types";

type RequestData = RejectConsentRequestParams;

export const rejectSelectAccountSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const rejectSelectAccountController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { oauthClient },
    data: { id },
  } = ctx;

  const { data } = await oauthClient.post<RejectConsentResponse>(
    "/admin/sessions/select-account/:id/reject",
    {
      params: { id },
      middleware: [clientCredentialsMiddleware()],
    },
  );

  return { body: data };
};
