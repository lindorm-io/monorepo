import { SessionStatus } from "@lindorm-io/common-enums";
import { RejectLoginRequestParams, RejectLoginResponse } from "@lindorm-io/common-types";
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
    redis: { authorizationSessionCache },
    entity: { authorizationSession },
    logger,
  } = ctx;

  assertSessionPending(authorizationSession.status.login);

  logger.debug("Updating authorization session");

  authorizationSession.status.login = SessionStatus.REJECTED;

  await authorizationSessionCache.update(authorizationSession);

  return { body: { redirectTo: createLoginRejectedUri(authorizationSession) } };
};
