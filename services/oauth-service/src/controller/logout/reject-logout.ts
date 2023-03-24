import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { assertSessionPending, createLogoutRejectedUri } from "../../util";
import {
  RejectLogoutRequestParams,
  RejectLogoutResponse,
  SessionStatus,
} from "@lindorm-io/common-types";

type RequestData = RejectLogoutRequestParams;

type ResponseBody = RejectLogoutResponse;

export const rejectLogoutSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const rejectLogoutController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    redis: { logoutSessionCache },
    entity: { logoutSession },
    logger,
  } = ctx;

  assertSessionPending(logoutSession.status);

  logger.debug("Updating logout session");

  logoutSession.status = SessionStatus.REJECTED;

  await logoutSessionCache.update(logoutSession);

  return { body: { redirectTo: createLogoutRejectedUri(logoutSession) } };
};
