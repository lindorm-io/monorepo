import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { ServerKoaController } from "../../types";
import {
  GetStrategyRequestParams,
  GetStrategyResponse,
  SessionStatuses,
} from "@lindorm-io/common-types";

type RequestData = GetStrategyRequestParams;

type ResponseBody = GetStrategyResponse;

export const getStrategyInfoSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getStrategyInfoController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<Partial<ResponseBody>> => {
  const {
    cache: { strategySessionCache },
    data: { id },
  } = ctx;

  try {
    const session = await strategySessionCache.find({ id });

    return {
      body: {
        expires: session.expires,
        strategy: session.strategy,
        status: session.status,
      },
    };
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }

    return { body: { status: SessionStatuses.EXPIRED } };
  }
};
