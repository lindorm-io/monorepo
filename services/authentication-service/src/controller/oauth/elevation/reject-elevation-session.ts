import { RejectElevationRequestParams } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { clientCredentialsMiddleware } from "../../../middleware";
import { ServerKoaController } from "../../../types";

type RequestData = RejectElevationRequestParams;

export const rejectElevationRequestSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const rejectElevationRequestController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { oauthClient },
    data: { id },
  } = ctx;

  await oauthClient.post("/admin/sessions/elevation/:id/reject", {
    params: { id },
    middleware: [clientCredentialsMiddleware()],
  });
};
