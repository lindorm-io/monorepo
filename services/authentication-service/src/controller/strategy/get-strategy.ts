import { SessionStatus } from "@lindorm-io/common-enums";
import { GetStrategyRequestParams, GetStrategyResponse } from "@lindorm-io/common-types";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";

type RequestData = GetStrategyRequestParams;

type ResponseBody = GetStrategyResponse;

export const getStrategySchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getStrategyController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<Partial<ResponseBody>> => {
  const {
    redis: { strategySessionCache },
    data: { id },
  } = ctx;

  try {
    const session = await strategySessionCache.find({ id });

    return {
      body: {
        expires: session.expires.toISOString(),
        strategy: session.strategy,
        status: session.status,
      },
    };
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }

    return { body: { status: SessionStatus.EXPIRED } };
  }
};
