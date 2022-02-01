import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { JOI_GUID, SessionStatus } from "../../common";

interface RequestData {
  id: string;
}

interface ResponseBody {
  status: SessionStatus;
}

export const getEnrolmentStatusSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
});

export const getEnrolmentStatusController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { enrolmentSessionCache },
    data: { id },
  } = ctx;

  try {
    const enrolment = await enrolmentSessionCache.find({ id });

    return {
      body: {
        status: enrolment.status,
      },
    };
  } catch (err: any) {
    if (!(err instanceof EntityNotFoundError)) {
      throw err;
    }

    return {
      body: {
        status: SessionStatus.EXPIRED,
      },
    };
  }
};
