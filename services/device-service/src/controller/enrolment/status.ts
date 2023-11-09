import { SessionStatus } from "@lindorm-io/common-enums";
import {
  GetEnrolmentStatusRequestParams,
  GetEnrolmentStatusResponse,
} from "@lindorm-io/common-types";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";

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
    redis: { enrolmentSessionCache },
    data: { id },
  } = ctx;

  try {
    const enrolment = await enrolmentSessionCache.find({ id });

    return { body: { status: enrolment.status } };
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }

    return { body: { status: SessionStatus.EXPIRED } };
  }
};
