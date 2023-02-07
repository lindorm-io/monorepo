import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { ServerKoaController } from "../../types";
import {
  GetEnrolmentStatusRequestParams,
  GetEnrolmentStatusResponse,
  SessionStatuses,
} from "@lindorm-io/common-types";

type RequestData = GetEnrolmentStatusRequestParams;

type ResponseBody = GetEnrolmentStatusResponse;

export const getEnrolmentStatusSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getEnrolmentStatusController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { enrolmentSessionCache },
    data: { id },
  } = ctx;

  try {
    const enrolment = await enrolmentSessionCache.find({ id });

    return { body: { status: enrolment.status } };
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }

    return { body: { status: SessionStatuses.EXPIRED } };
  }
};
