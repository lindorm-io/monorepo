import {
  RejectConsentRequestParams,
  RejectConsentResponse,
  SessionStatus,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";
import { assertSessionPending, createConsentRejectedUri } from "../../util";

type RequestData = RejectConsentRequestParams;

type ResponseBody = RejectConsentResponse;

export const rejectConsentSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const rejectConsentController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    redis: { authorizationSessionCache },
    entity: { authorizationSession },
    logger,
  } = ctx;

  assertSessionPending(authorizationSession.status.consent);

  logger.debug("Updating authorization session");

  authorizationSession.status.consent = SessionStatus.REJECTED;

  await authorizationSessionCache.update(authorizationSession);

  return { body: { redirectTo: createConsentRejectedUri(authorizationSession) } };
};
