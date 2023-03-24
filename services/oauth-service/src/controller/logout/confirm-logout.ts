import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { assertSessionPending, createLogoutVerifyUri } from "../../util";
import {
  ConfirmLogoutRequestBody,
  ConfirmLogoutRequestParams,
  ConfirmLogoutResponse,
  SessionStatus,
} from "@lindorm-io/common-types";

type RequestData = ConfirmLogoutRequestParams & ConfirmLogoutRequestBody;

type ResponseBody = ConfirmLogoutResponse;

export const confirmLogoutSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    browserSessionId: Joi.string().guid().allow(null).required(),
    clientSessionId: Joi.string().guid().allow(null).required(),
  })
  .required();

export const confirmLogoutController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    redis: { logoutSessionCache },
    data: { browserSessionId, clientSessionId },
    entity: { logoutSession },
    logger,
  } = ctx;

  assertSessionPending(logoutSession.status);

  logger.debug("Updating logout session");

  logoutSession.confirmedLogout.browserSessionId = browserSessionId;
  logoutSession.confirmedLogout.clientSessionId = clientSessionId;

  logoutSession.status = SessionStatus.CONFIRMED;

  await logoutSessionCache.update(logoutSession);

  return { body: { redirectTo: createLogoutVerifyUri(logoutSession) } };
};
