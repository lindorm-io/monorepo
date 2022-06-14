import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { JOI_GUID, SessionStatus } from "../../common";
import { ServerKoaController } from "../../types";
import { StrategySessionAttributes } from "../../entity";

interface RequestData {
  id: string;
}

export const getStrategyInfoSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const getStrategyInfoController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<Partial<StrategySessionAttributes>> => {
  const {
    cache: { strategySessionCache },
    data: { id },
  } = ctx;

  try {
    const session = await strategySessionCache.find({ id });

    return {
      body: {
        expires: session.expires,
        method: session.method,
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
