import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { RejectAuthenticationRequestParams, SessionStatus } from "@lindorm-io/common-types";

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
