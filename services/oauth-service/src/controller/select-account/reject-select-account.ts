import { SessionStatus } from "@lindorm-io/common-enums";
import {
  RejectSelectAccountRequestParams,
  RejectSelectAccountResponse,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";
import { assertSessionPending, createSelectAccountRejectedUri } from "../../util";

type RequestData = RejectSelectAccountRequestParams;

type ResponseBody = RejectSelectAccountResponse;

export const rejectSelectAccountSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const rejectSelectAccountController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    redis: { authorizationSessionCache },
    entity: { authorizationSession },
    logger,
  } = ctx;

  assertSessionPending(authorizationSession.status.selectAccount);

  logger.debug("Updating authorization session");

  authorizationSession.status.selectAccount = SessionStatus.REJECTED;

  await authorizationSessionCache.update(authorizationSession);

  return { body: { redirectTo: createSelectAccountRejectedUri(authorizationSession) } };
};
