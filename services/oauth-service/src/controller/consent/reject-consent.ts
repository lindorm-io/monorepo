import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, SessionStatus } from "../../common";
import { ServerKoaController } from "../../types";
import { assertSessionPending, createConsentRejectedUri } from "../../util";

interface RequestData {
  id: string;
}

export const rejectConsentSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const rejectConsentController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { authorizationSessionCache },
    entity: { authorizationSession },
    logger,
  } = ctx;

  assertSessionPending(authorizationSession.status.consent);

  logger.debug("Updating authorization session");

  authorizationSession.status.consent = SessionStatus.REJECTED;

  await authorizationSessionCache.update(authorizationSession);

  return { body: { redirectTo: createConsentRejectedUri(authorizationSession) } };
};
