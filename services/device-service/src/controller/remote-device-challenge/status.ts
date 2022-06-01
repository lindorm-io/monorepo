import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, SessionStatus } from "../../common";
import { EntityNotFoundError } from "@lindorm-io/entity";

interface RequestData {
  id: string;
}

interface ResponseBody {
  status: SessionStatus;
}

export const getRdcSessionStatusSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const getRdcSessionStatusController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { rdcSessionCache },
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
