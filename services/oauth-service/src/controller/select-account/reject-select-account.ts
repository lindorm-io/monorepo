import {
  RejectSelectAccountRequestParams,
  RejectSelectAccountResponse,
  SessionStatus,
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
    redis: { authorizationRequestCache },
    entity: { authorizationRequest },
    logger,
  } = ctx;

  assertSessionPending(authorizationRequest.status.selectAccount);

  logger.debug("Updating authorization session");

  authorizationRequest.status.selectAccount = SessionStatus.REJECTED;

  await authorizationRequestCache.update(authorizationRequest);

  return { body: { redirectTo: createSelectAccountRejectedUri(authorizationRequest) } };
};
