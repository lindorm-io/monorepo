import {
  RejectLoginRequestParams,
  RejectLoginResponse,
  SessionStatus,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";
import { assertSessionPending, createLoginRejectedUri } from "../../util";

type RequestData = RejectLoginRequestParams;

type ResponseBody = RejectLoginResponse;

export const rejectLoginSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const rejectLoginController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    redis: { authorizationRequestCache },
    entity: { authorizationRequest },
    logger,
  } = ctx;

  assertSessionPending(authorizationRequest.status.login);

  logger.debug("Updating authorization session");

  authorizationRequest.status.login = SessionStatus.REJECTED;

  await authorizationRequestCache.update(authorizationRequest);

  return { body: { redirectTo: createLoginRejectedUri(authorizationRequest) } };
};
