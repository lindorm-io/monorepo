import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { ServerKoaController } from "../../types";
import {
  GetRdcStatusRequestParams,
  GetRdcStatusResponse,
  SessionStatus,
} from "@lindorm-io/common-types";

type RequestData = GetRdcStatusRequestParams;

type ResponseBody = GetRdcStatusResponse;

export const getRdcSessionStatusSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getRdcSessionStatusController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    redis: { rdcSessionCache },
    data: { id },
  } = ctx;

  try {
    const rdcSession = await rdcSessionCache.find({ id });

    return { body: { status: rdcSession.status } };
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }

    return { body: { status: SessionStatus.EXPIRED } };
  }
};
