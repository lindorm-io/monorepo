import { SessionStatus } from "@lindorm-io/common-enums";
import { RejectElevationSessionRequestParams } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";
import { assertSessionPending, createElevationRejectedUri } from "../../util";

type RequestData = RejectElevationSessionRequestParams;

export const rejectElevationSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const rejectElevationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    redis: { elevationSessionCache },
    entity: { elevationSession },
    logger,
  } = ctx;

  assertSessionPending(elevationSession.status);

  logger.debug("Updating elevation session");

  elevationSession.status = SessionStatus.REJECTED;

  await elevationSessionCache.update(elevationSession);

  if (elevationSession.redirectUri) {
    return { body: { redirectTo: createElevationRejectedUri(elevationSession) } };
  }
};
