import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, ResponseWithRedirectBody, SessionStatus } from "../../common";
import { ServerKoaController } from "../../types";
import { createLogoutVerifyUri } from "../../util";

interface RequestData {
  id: string;
}

export const confirmLogoutSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const confirmLogoutController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseWithRedirectBody> => {
  const {
    cache: { logoutSessionCache },
    entity: { logoutSession },
    logger,
  } = ctx;

  if ([SessionStatus.CONFIRMED, SessionStatus.REJECTED].includes(logoutSession.status)) {
    throw new ClientError("Logout has already been set");
  }

  logger.debug("Updating logout session");

  logoutSession.status = SessionStatus.CONFIRMED;

  await logoutSessionCache.update(logoutSession);

  return { body: { redirectTo: createLogoutVerifyUri(logoutSession) } };
};
