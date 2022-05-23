import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, JOI_JWT } from "../../common";

interface RequestData {
  id: string;
  enrolmentSessionToken: string;
}

export const rejectEnrolmentSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
  enrolmentSessionToken: JOI_JWT.required(),
});

export const rejectEnrolmentController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { enrolmentSessionCache },
    entity: { enrolmentSession },
  } = ctx;

  await enrolmentSessionCache.destroy(enrolmentSession);
};
