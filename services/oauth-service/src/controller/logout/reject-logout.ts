import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, SessionStatus } from "../../common";
import { ServerKoaController } from "../../types";
import { createURL } from "@lindorm-io/core";

interface RequestData {
  id: string;
}

export const rejectLogoutSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const rejectLogoutController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { logoutSessionCache },
    entity: { logoutSession },
    logger,
  } = ctx;

  if ([SessionStatus.CONFIRMED, SessionStatus.REJECTED].includes(logoutSession.status)) {
    throw new ClientError("Logout has already been set");
  }

  logger.debug("Updating logout session");

  logoutSession.status = SessionStatus.REJECTED;

  await logoutSessionCache.update(logoutSession);

  return {
    body: {
      redirectTo: createURL(logoutSession.redirectUri, {
        query: {
          error: "request_rejected",
          error_description: "logout_rejected",
          state: logoutSession.state,
        },
      }).toString(),
    },
  };
};
