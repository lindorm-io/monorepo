import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, SessionStatus } from "../../common";

interface RequestData {
  id: string;
  rdcSessionId: never;
  rdcSessionStatus: never;
}

export const rejectFlowSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
  rdcSessionId: Joi.string().optional(),
  rdcSessionStatus: Joi.string().optional(),
});

export const rejectFlowController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { flowSessionCache },
    entity: { flowSession },
  } = ctx;

  flowSession.status = SessionStatus.REJECTED;

  await flowSessionCache.update(flowSession);

  return {};
};
