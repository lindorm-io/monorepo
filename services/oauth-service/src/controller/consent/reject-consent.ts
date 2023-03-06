import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { assertSessionPending, createConsentRejectedUri } from "../../util";
import {
  RejectConsentRequestParams,
  RejectConsentResponse,
  SessionStatus,
} from "@lindorm-io/common-types";

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
