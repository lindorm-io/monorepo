import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { assertSessionPending, createLoginRejectedUri } from "../../util";
import {
  RejectLoginRequestParams,
  RejectLoginResponse,
  SessionStatuses,
} from "@lindorm-io/common-types";

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
    cache: { authorizationSessionCache },
    entity: { authorizationSession },
    logger,
  } = ctx;

  assertSessionPending(authorizationSession.status.login);

  logger.debug("Updating authorization session");

  authorizationSession.status.login = SessionStatuses.REJECTED;

  await authorizationSessionCache.update(authorizationSession);

  return { body: { redirectTo: createLoginRejectedUri(authorizationSession) } };
};
