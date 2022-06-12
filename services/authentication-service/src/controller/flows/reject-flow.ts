import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, JOI_JWT, SessionStatus } from "../../common";
import { ServerKoaController } from "../../types";

interface RequestData {
  id: string;
  flowToken: string;
}

export const rejectFlowSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
  flowToken: JOI_JWT.required(),
});

export const rejectFlowController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { flowSessionCache },
    entity: { flowSession },
  } = ctx;

  flowSession.status = SessionStatus.REJECTED;

  await flowSessionCache.update(flowSession);
};
