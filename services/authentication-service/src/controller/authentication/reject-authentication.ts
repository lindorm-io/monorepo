import { RejectAuthenticationRequestParams, SessionStatus } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";

type RequestData = RejectAuthenticationRequestParams;

export const rejectAuthenticationSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const rejectAuthenticationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    redis: { authenticationSessionCache },
    entity: { authenticationSession },
  } = ctx;

  authenticationSession.status = SessionStatus.REJECTED;

  await authenticationSessionCache.update(authenticationSession);
};
