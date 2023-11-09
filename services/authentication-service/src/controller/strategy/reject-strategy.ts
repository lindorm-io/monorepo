import { SessionStatus } from "@lindorm-io/common-enums";
import { RejectStrategyRequestParams } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";

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
    redis: { strategySessionCache },
    entity: { strategySession },
  } = ctx;

  strategySession.status = SessionStatus.REJECTED;

  await strategySessionCache.update(strategySession);
};
