import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, JOI_JWT, SessionStatus } from "../../common";
import { ServerKoaController } from "../../types";

interface RequestData {
  id: string;
  strategySessionToken: string;
}

export const rejectStrategySchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
    strategySessionToken: JOI_JWT.required(),
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
