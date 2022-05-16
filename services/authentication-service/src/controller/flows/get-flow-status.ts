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

export const getFlowStatusSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
});

export const getFlowStatusController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { flowSessionCache },
    data: { id },
  } = ctx;

  try {
    const session = await flowSessionCache.find({ id });

    return { body: { status: session.status } };
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }

    return { body: { status: SessionStatus.EXPIRED } };
  }
};
