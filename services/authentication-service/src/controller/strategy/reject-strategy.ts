import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { RejectStrategyRequestParams, SessionStatuses } from "@lindorm-io/common-types";

type RequestData = RejectStrategyRequestParams;

export const rejectStrategySchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const rejectStrategyController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { strategySessionCache },
    entity: { strategySession },
  } = ctx;

  strategySession.status = SessionStatuses.REJECTED;

  await strategySessionCache.update(strategySession);
};
