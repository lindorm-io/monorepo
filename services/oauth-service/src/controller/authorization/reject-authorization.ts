import { SessionStatus } from "@lindorm-io/common-enums";
import {
  RejectAuthorizationRequestParams,
  RejectAuthorizationResponse,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";
import { createAuthorizationRejectedUri } from "../../util";

type RequestData = RejectAuthorizationRequestParams;

type ResponseBody = RejectAuthorizationResponse;

export const rejectAuthorizationSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const rejectAuthorizationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    redis: { authorizationSessionCache },
    entity: { authorizationSession },
    logger,
  } = ctx;

  logger.debug("Updating authorization session");

  authorizationSession.status.consent = SessionStatus.REJECTED;
  authorizationSession.status.login = SessionStatus.REJECTED;
  authorizationSession.status.selectAccount = SessionStatus.REJECTED;

  await authorizationSessionCache.update(authorizationSession);

  return { body: { redirectTo: createAuthorizationRejectedUri(authorizationSession) } };
};
