import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, ResponseWithRedirectBody, SessionStatus } from "../../common";
import { ServerKoaController } from "../../types";
import { createLoginRejectedUri } from "../../util";

interface RequestData {
  id: string;
}

export const rejectLoginSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const rejectLoginController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseWithRedirectBody> => {
  const {
    cache: { authorizationSessionCache },
    entity: { authorizationSession },
    logger,
  } = ctx;

  if (
    [SessionStatus.CONFIRMED, SessionStatus.REJECTED, SessionStatus.SKIP].includes(
      authorizationSession.status.login,
    )
  ) {
    throw new ClientError("Login has already been set");
  }

  logger.debug("Updating authorization session");

  authorizationSession.status.login = SessionStatus.REJECTED;

  await authorizationSessionCache.update(authorizationSession);

  return { body: { redirectTo: createLoginRejectedUri(authorizationSession) } };
};
