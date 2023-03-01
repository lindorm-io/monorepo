import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { RejectLoginResponse } from "@lindorm-io/common-types";

type RequestData = {
  id: string;
};

export const rejectLoginSessionSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const rejectLoginSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { oauthClient },
    data: { id },
  } = ctx;

  const { data } = await oauthClient.post<RejectLoginResponse>("/admin/sessions/login/:id/reject", {
    params: { id },
    middleware: [clientCredentialsMiddleware()],
  });

  return { body: data };
};
