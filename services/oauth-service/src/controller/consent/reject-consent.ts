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
    redis: { authorizationRequestCache },
    entity: { authorizationRequest },
    logger,
  } = ctx;

  assertSessionPending(authorizationRequest.status.consent);

  logger.debug("Updating authorization session");

  authorizationRequest.status.consent = SessionStatus.REJECTED;

  await authorizationRequestCache.update(authorizationRequest);

  return { body: { redirectTo: createConsentRejectedUri(authorizationRequest) } };
};
