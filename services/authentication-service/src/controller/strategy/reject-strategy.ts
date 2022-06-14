import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, SessionStatus } from "../../common";
import { ServerKoaController } from "../../types";

interface RequestData {
  id: string;
}

export const rejectStrategySchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const rejectStrategyController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { strategySessionCache },
    entity: { strategySession },
  } = ctx;

  strategySession.status = SessionStatus.REJECTED;

  await strategySessionCache.update(strategySession);
};
