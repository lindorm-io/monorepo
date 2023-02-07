import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { assertSessionPending, createLogoutVerifyUri } from "../../util";
import {
  ConfirmLogoutRequestParams,
  ConfirmLogoutResponse,
  SessionStatuses,
} from "@lindorm-io/common-types";

type RequestData = ConfirmLogoutRequestParams;

type ResponseBody = ConfirmLogoutResponse;

export const confirmLogoutSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const confirmLogoutController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { logoutSessionCache },
    entity: { logoutSession },
    logger,
  } = ctx;

  assertSessionPending(logoutSession.status);

  logger.debug("Updating logout session");

  logoutSession.status = SessionStatuses.CONFIRMED;

  await logoutSessionCache.update(logoutSession);

  return { body: { redirectTo: createLogoutVerifyUri(logoutSession) } };
};
