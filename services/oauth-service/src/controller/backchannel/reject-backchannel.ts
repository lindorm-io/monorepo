import { SessionStatus } from "@lindorm-io/common-enums";
import { RejectBackchannelRequestParams } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";

type RequestData = RejectBackchannelRequestParams;

export const rejectBackchannelSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const rejectBackchannelController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    redis: { backchannelSessionCache },
    entity: { backchannelSession },
    logger,
  } = ctx;

  logger.debug("Updating backchannel session");

  backchannelSession.status.consent = SessionStatus.REJECTED;
  backchannelSession.status.login = SessionStatus.REJECTED;

  await backchannelSessionCache.update(backchannelSession);
};
