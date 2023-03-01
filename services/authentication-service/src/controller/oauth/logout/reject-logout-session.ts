import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../../types";
import { clientCredentialsMiddleware } from "../../../middleware";
import { RejectLogoutResponse } from "@lindorm-io/common-types";

type RequestData = {
  id: string;
};

export const rejectLogoutSessionSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const rejectLogoutSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { oauthClient },
    data: { id },
  } = ctx;

  const { data } = await oauthClient.post<RejectLogoutResponse>(
    "/admin/sessions/logout/:id/reject",
    {
      params: { id },
      middleware: [clientCredentialsMiddleware()],
    },
  );

  return { body: data };
};
