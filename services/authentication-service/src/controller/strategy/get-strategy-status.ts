import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { JOI_GUID, SessionStatus } from "../../common";
import { ServerKoaController } from "../../types";

interface RequestData {
  id: string;
}

interface ResponseBody {
  status: SessionStatus;
}

export const getStrategyStatusSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const getStrategyStatusController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { strategySessionCache },
    data: { id },
  } = ctx;

  try {
    const session = await strategySessionCache.find({ id });

    return { body: { status: session.status } };
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }

    return { body: { status: SessionStatus.EXPIRED } };
  }
};
