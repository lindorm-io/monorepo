import { RejectElevationRequestParams, SessionStatus } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";
import { assertSessionPending, createElevationRejectedUri } from "../../util";

type RequestData = RejectElevationRequestParams;

export const rejectElevationSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const rejectElevationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    redis: { elevationRequestCache },
    entity: { elevationRequest },
    logger,
  } = ctx;

  assertSessionPending(elevationRequest.status);

  logger.debug("Updating elevation session");

  elevationRequest.status = SessionStatus.REJECTED;

  await elevationRequestCache.update(elevationRequest);

  if (elevationRequest.redirectUri) {
    return { body: { redirectTo: createElevationRejectedUri(elevationRequest) } };
  }
};
