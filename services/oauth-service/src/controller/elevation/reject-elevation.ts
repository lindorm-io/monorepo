import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, SessionStatus } from "../../common";
import { ServerKoaController } from "../../types";
import { assertSessionPending } from "../../util";

interface RequestData {
  id: string;
}

export const rejectElevationSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const rejectElevationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { elevationSessionCache },
    entity: { elevationSession },
    logger,
  } = ctx;

  assertSessionPending(elevationSession.status);

  logger.debug("Updating elevation session");

  elevationSession.status = SessionStatus.REJECTED;

  await elevationSessionCache.update(elevationSession);
};
